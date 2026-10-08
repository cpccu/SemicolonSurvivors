import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerDatabaseClient } from "@/lib/database/server";
import type { CampusDatabase } from "@/lib/database/schema";
import { ApplicationError } from "@/lib/observability/errors";
import { entityIdSchema } from "@/lib/validation/input";

export type VerifiedIdentity = Readonly<{ userId: string; assurance: "aal1" | "aal2" }>;

export async function requireVerifiedIdentity(
  client?: SupabaseClient<CampusDatabase>,
): Promise<VerifiedIdentity> {
  const database = client ?? await createServerDatabaseClient();
  // Verify with the auth service; cookie session data and editable metadata are not authorization.
  const { data, error } = await database.auth.getUser();
  if (error || !data.user) throw new ApplicationError("authentication");
  const userId = entityIdSchema.safeParse(data.user.id);
  if (!userId.success) throw new ApplicationError("authentication");

  const assurance = await database.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw new ApplicationError("authentication");
  return {
    userId: userId.data,
    assurance: assurance.data.currentLevel === "aal2" ? "aal2" : "aal1",
  };
}
