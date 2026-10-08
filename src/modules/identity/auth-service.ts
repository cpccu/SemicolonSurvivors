import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";
import { requireVerifiedIdentity } from "@/lib/auth/identity";
import { ApplicationError } from "@/lib/observability/errors";
import { requireEmailRollout } from "@/lib/security/configuration";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { accountAccessSchema } from "@/lib/authorization/models";
import { databaseAccessRepository, databaseFailure } from "./repository";
import { getSessionView } from "./session-service";

export const neutralResetMessage = "If this address is eligible, password reset instructions will be sent to its approved email.";

export async function signIn(client: SupabaseClient<CampusDatabase>, email: string, password: string) {
  await enforceRateLimit("sign-in", email);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new ApplicationError("authentication");
  try {
    const session = await getSessionView(client);
    if (!session.authenticated || !session.account || !["active", "pending"].includes(session.account.status)) {
      throw new ApplicationError("authorization");
    }
    return session;
  } catch (error) {
    await client.auth.signOut({ scope: "local" });
    throw error;
  }
}

export async function requestPasswordReset(client: SupabaseClient<CampusDatabase>, email: string) {
  const redirectTo = requireEmailRollout();
  await enforceRateLimit("reset", email);
  // Managed auth deliberately gives a neutral response for missing accounts; do not expose provider errors.
  try {
    const result = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (result.error) console.error(JSON.stringify({ event: "password_reset_exception", code: "unexpected" }));
  } catch {
    console.error(JSON.stringify({ event: "password_reset_exception", code: "unexpected" }));
  }
  return { message: neutralResetMessage };
}

export async function confirmManagedLink(client: SupabaseClient<CampusDatabase>, tokenHash: string, type: "invite" | "recovery") {
  await enforceRateLimit("confirm", tokenHash);
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  if (verified.error || !verified.data.user) throw new ApplicationError("authentication");
  try {
    if (type === "invite") {
      const bound = await client.rpc("enrollment_bind_identity");
      if (bound.error) throw databaseFailure(bound.error.code);
      if (bound.data !== true) throw new ApplicationError("authorization");
    }
    const identity = await requireVerifiedIdentity(client);
    const account = accountAccessSchema.parse(await databaseAccessRepository(client).getAccessForUser(identity.userId));
    if (!["pending", "active"].includes(account.status)) throw new ApplicationError("authorization");
    return { nextStep: "set_password" as const };
  } catch (error) {
    await client.auth.signOut({ scope: "local" });
    throw error;
  }
}

export async function setPassword(client: SupabaseClient<CampusDatabase>, password: string) {
  const identity = await requireVerifiedIdentity(client);
  await enforceRateLimit("password", identity.userId);
  const account = accountAccessSchema.parse(await databaseAccessRepository(client).getAccessForUser(identity.userId));
  if (!["pending", "active"].includes(account.status)) throw new ApplicationError("authorization");
  if (account.status === "pending") {
    const bound = await client.rpc("enrollment_bind_identity");
    if (bound.error) throw databaseFailure(bound.error.code);
    if (bound.data !== true) throw new ApplicationError("authorization");
  }
  const updated = await client.auth.updateUser({ password });
  if (updated.error) throw new ApplicationError("validation");
  if (account.status === "pending") {
    const completed = await client.rpc("enrollment_complete_activation");
    if (completed.error) throw databaseFailure(completed.error.code);
    if (completed.data !== true) throw new ApplicationError("authorization");
  }
  return getSessionView(client);
}
