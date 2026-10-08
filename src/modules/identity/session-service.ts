import "server-only";
import { isAuthSessionMissingError, type SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";
import { requireVerifiedIdentity } from "@/lib/auth/identity";
import { ApplicationError } from "@/lib/observability/errors";
import { databaseAccessRepository, databaseFailure } from "./repository";
import { accountAccessSchema } from "@/lib/authorization/models";
import { identityReadiness } from "./readiness";
import type { SessionView } from "./schemas";

export async function getSessionView(client: SupabaseClient<CampusDatabase>): Promise<SessionView> {
  const readiness = await identityReadiness();
  const anonymous: SessionView = { authenticated: false, account: null, fullName: null, assurance: null, readiness };
  if (!readiness.signInAvailable) return anonymous;
  const verified = await client.auth.getUser();
  if (!verified.data.user) {
    if (verified.error && !isAuthSessionMissingError(verified.error)) throw new ApplicationError("authentication");
    return anonymous;
  }
  const identity = await requireVerifiedIdentity(client);
  const account = accountAccessSchema.parse(await databaseAccessRepository(client).getAccessForUser(identity.userId));
  const profile = await client.from("profiles").select("full_name").eq("user_id", identity.userId).single();
  if (profile.error) throw databaseFailure(profile.error.code);
  return { authenticated: true, account, fullName: profile.data.full_name, assurance: identity.assurance, readiness };
}
