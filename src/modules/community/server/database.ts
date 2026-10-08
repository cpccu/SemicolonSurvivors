import "server-only";
import { createHash } from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { ApplicationError } from "@/lib/observability/errors";
import type { IdentityFunctions, IdentityTables } from "@/modules/identity/db-types";
import type { CommunityFunctions, CommunityTables } from "../db-types";
import type { AdministrationFunctions } from "@/modules/administration/db-types";

export type CommunityDatabase = { public: { Tables: CommunityTables & IdentityTables; Functions: CommunityFunctions & IdentityFunctions & AdministrationFunctions; Views: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };
export type CommunityClient = SupabaseClient<CommunityDatabase>;
export class CommunityFailure extends Error { constructor(readonly code: string, readonly status: number, message: string) { super(message); } }
export function checkResult(error: PostgrestError | null) {
  if (!error) return;
  if (["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(error.code)) throw new ApplicationError("configuration");
  if (error.code === "42501") throw new ApplicationError("authorization");
  if (error.code === "P0002") throw new CommunityFailure("not_found", 404, "This record is unavailable.");
  if (["22023", "23502", "23503", "23514", "22P02", "22007", "22008"].includes(error.code)) throw new ApplicationError("validation");
  if (["P0001", "23505"].includes(error.code)) throw new CommunityFailure("conflict", 409, "This record or assignment changed. Refresh before continuing.");
  throw new ApplicationError("unexpected");
}
export async function activeUser(database: CommunityClient) {
  const user = await database.auth.getUser();
  if (user.error || !user.data.user) throw new ApplicationError("authentication");
  const access = await database.rpc("campus_access", {}); checkResult(access.error);
  if (!z.object({ status: z.literal("active") }).safeParse(access.data).success) throw new ApplicationError("authorization");
  return user.data.user.id;
}
export async function communityBudget(identity: string, upload = false) {
  const admin = createAdminDatabaseClient();
  const action = upload ? "community-upload" : "community-write";
  const digest = createHash("sha256").update(`${action}:${identity}`).digest("hex");
  const result = await admin.rpc("consume_rate_limit", { p_key: `${action}:${digest}`, p_limit: upload ? 12 : 60, p_window_seconds: 3600 });
  checkResult(result.error);
  if (result.data !== true) throw new ApplicationError("quota");
}
