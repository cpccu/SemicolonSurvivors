import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";
import type { AuthorizationActor } from "@/lib/authorization/models";
import { getRequestActor } from "@/lib/auth/request-actor";
import { ApplicationError } from "@/lib/observability/errors";
import { enforceMfaRateLimit } from "./mfa-rate-limit";
import { hasFreshMfaProof, validManagedTotpUri } from "./mfa-policy";
import { safeTotpQrDataUri } from "./mfa-qr";
import { mfaStateSchema, totpChallengeSchema, totpSetupSchema, type MfaState } from "./mfa-schemas";

type Client = SupabaseClient<CampusDatabase>;

async function freshMfa(client: Client, actor: AuthorizationActor) {
  if (actor.assurance !== "aal2") return false;
  const verified = await client.auth.getClaims();
  if (verified.error || !verified.data) throw new ApplicationError("authentication");
  return hasFreshMfaProof(verified.data.claims, actor.userId, Math.floor(Date.now() / 1000));
}

async function factorState(client: Client, actor: AuthorizationActor): Promise<MfaState> {
  const listed = await client.auth.mfa.listFactors();
  if (listed.error || !listed.data || listed.data.all.length > 20) throw new ApplicationError("unexpected");
  const factors = listed.data.all.filter((factor) => factor.factor_type === "totp").map((factor) => ({
    id: factor.id, friendlyName: factor.friendly_name || "Authenticator app", status: factor.status,
  }));
  const hasOtherVerifiedFactors = listed.data.all.some((factor) => factor.factor_type !== "totp" && factor.status === "verified");
  const fresh = await freshMfa(client, actor);
  const parsed = mfaStateSchema.safeParse({
    currentLevel: actor.assurance, freshMfa: fresh, hasOtherVerifiedFactors, factors,
    canEnroll: factors.length === 0 && (!hasOtherVerifiedFactors || fresh),
  });
  if (!parsed.success) throw new ApplicationError("unexpected");
  return parsed.data;
}

export async function getMfaState(client: Client) {
  const actor = await getRequestActor(client);
  await enforceMfaRateLimit("mfa-list", actor.userId);
  return factorState(client, actor);
}

export async function enrollTotp(client: Client) {
  const actor = await getRequestActor(client);
  // One persistent setup slot per five minutes bounds concurrent attempts before contacting Auth.
  await enforceMfaRateLimit("mfa-setup", actor.userId);
  const state = await factorState(client, actor);
  if (!state.canEnroll) throw new ApplicationError("conflict");
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CampusOS authenticator", issuer: "CampusOS" });
  if (enrolled.error || !enrolled.data) throw new ApplicationError("conflict");
  if (enrolled.data.type !== "totp" || !validManagedTotpUri(enrolled.data.totp.uri, enrolled.data.totp.secret)) {
    throw new ApplicationError("unexpected");
  }
  const parsed = totpSetupSchema.safeParse({
    factorId: enrolled.data.id, secret: enrolled.data.totp.secret,
    qrCode: safeTotpQrDataUri(enrolled.data.totp.qr_code),
  });
  if (!parsed.success) throw new ApplicationError("unexpected");
  // Only this authenticated no-store response contains the setup secret; no app persistence or logging.
  return parsed.data;
}

async function requireOwnTotp(client: Client, actor: AuthorizationActor, factorId: string) {
  const state = await factorState(client, actor);
  const target = state.factors.find((factor) => factor.id === factorId);
  if (!target) throw new ApplicationError("authorization");
  const alreadyProtected = state.hasOtherVerifiedFactors || state.factors.some((factor) => factor.status === "verified");
  // A pending factor cannot become a shortcut around an account's existing verified MFA.
  if (target.status === "unverified" && alreadyProtected && !state.freshMfa) throw new ApplicationError("authorization");
  return state;
}

export async function challengeTotp(client: Client, factorId: string) {
  const actor = await getRequestActor(client);
  await enforceMfaRateLimit("mfa-challenge", actor.userId);
  await requireOwnTotp(client, actor, factorId);
  const challenged = await client.auth.mfa.challenge({ factorId });
  if (challenged.error || !challenged.data || challenged.data.type !== "totp") throw new ApplicationError("authentication");
  const parsed = totpChallengeSchema.safeParse({ factorId, challengeId: challenged.data.id, expiresAt: challenged.data.expires_at });
  if (!parsed.success) throw new ApplicationError("unexpected");
  return parsed.data;
}

export async function verifyTotp(client: Client, input: { factorId: string; challengeId: string; code: string }) {
  const actor = await getRequestActor(client);
  await enforceMfaRateLimit("mfa-verify", actor.userId);
  await requireOwnTotp(client, actor, input.factorId);
  const verified = await client.auth.mfa.verify(input);
  if (verified.error || !verified.data || verified.data.user.id !== actor.userId) throw new ApplicationError("authentication");
  const steppedUp = await getRequestActor(client);
  if (steppedUp.userId !== actor.userId || steppedUp.assurance !== "aal2") throw new ApplicationError("authentication");
  const state = await factorState(client, steppedUp);
  if (!state.freshMfa || !state.factors.some((factor) => factor.id === input.factorId && factor.status === "verified")) {
    throw new ApplicationError("authentication");
  }
  return state;
}

export async function removeTotp(client: Client, factorId: string, confirmRemoval: boolean) {
  if (confirmRemoval !== true) throw new ApplicationError("validation");
  const actor = await getRequestActor(client);
  await enforceMfaRateLimit("mfa-remove", actor.userId);
  const state = await requireOwnTotp(client, actor, factorId);
  if (!state.freshMfa || actor.assurance !== "aal2") throw new ApplicationError("authorization");
  const removed = await client.auth.mfa.unenroll({ factorId });
  if (removed.error || removed.data?.id !== factorId) throw new ApplicationError("conflict");
  // Drop this browser's elevated session after removal rather than displaying a stale assurance level.
  const signedOut = await client.auth.signOut({ scope: "local" });
  if (signedOut.error) throw new ApplicationError("unexpected");
  return { removed: true as const, signedOut: true as const };
}
