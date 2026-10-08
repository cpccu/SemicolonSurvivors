import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountAccessSchema, type AuthorizationActor, type PolicyDecision } from "@/lib/authorization/models";
import type { CampusDatabase } from "@/lib/database/schema";
import { ApplicationError } from "@/lib/observability/errors";
import { requireVerifiedIdentity } from "./identity";

export interface AccountAccessRepository {
  getAccessForUser(userId: string): Promise<unknown>;
}

export async function requireAuthorizationActor(
  repository: AccountAccessRepository,
  client?: SupabaseClient<CampusDatabase>,
): Promise<AuthorizationActor> {
  const identity = await requireVerifiedIdentity(client);
  const record = accountAccessSchema.safeParse(await repository.getAccessForUser(identity.userId));
  if (!record.success || record.data.userId !== identity.userId || record.data.status !== "active") {
    throw new ApplicationError("authorization");
  }

  // Assurance is verified independently; the repository cannot manufacture an MFA claim.
  return { ...record.data, assurance: identity.assurance };
}

export function assertAuthorized(decision: PolicyDecision): asserts decision is { allowed: true } {
  if (!decision.allowed) throw new ApplicationError("authorization");
}
