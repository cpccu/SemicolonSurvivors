import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountAccessSchema } from "@/lib/authorization/models";
import type { CampusDatabase } from "@/lib/database/schema";
import { ApplicationError } from "@/lib/observability/errors";
import type { AccountAccessRepository } from "@/lib/auth/access";
import { importReportSchema, recentImportsSchema, type RosterRow } from "./schemas";

export function databaseAccessRepository(client: SupabaseClient<CampusDatabase>): AccountAccessRepository {
  return {
    async getAccessForUser(userId) {
      const { data, error } = await client.rpc("campus_access");
      if (error) throw databaseFailure(error.code);
      const record = accountAccessSchema.safeParse(data);
      if (!record.success || record.data.userId !== userId) throw new ApplicationError("authorization");
      return record.data;
    },
  };
}

export function databaseFailure(code: string): ApplicationError {
  if (code === "42501") return new ApplicationError("authorization");
  if (code === "23505") return new ApplicationError("conflict");
  if (code === "22023" || code === "23514") return new ApplicationError("validation");
  if (code === "PGRST202" || code === "42P01" || code === "42883") return new ApplicationError("configuration");
  return new ApplicationError("unexpected");
}

export async function stageImport(client: SupabaseClient<CampusDatabase>, scopeId: string, rows: RosterRow[]) {
  const { data, error } = await client.rpc("enrollment_stage_import", { p_scope_id: scopeId, p_rows: rows });
  if (error) throw databaseFailure(error.code);
  const parsed = importReportSchema.safeParse(data);
  if (!parsed.success) throw new ApplicationError("unexpected");
  return parsed.data;
}

export async function confirmImport(client: SupabaseClient<CampusDatabase>, batchId: string, scopeId: string) {
  const { data, error } = await client.rpc("enrollment_confirm_import", { p_batch_id: batchId, p_scope_id: scopeId });
  if (error) throw databaseFailure(error.code);
  const parsed = importReportSchema.safeParse(data);
  if (!parsed.success) throw new ApplicationError("unexpected");
  return parsed.data;
}

export async function importReport(client: SupabaseClient<CampusDatabase>, batchId: string, scopeId: string) {
  const { data, error } = await client.rpc("enrollment_import_report", { p_batch_id: batchId, p_scope_id: scopeId });
  if (error) throw databaseFailure(error.code);
  const parsed = importReportSchema.safeParse(data);
  if (!parsed.success) throw new ApplicationError("unexpected");
  return parsed.data;
}

export async function recentImports(client: SupabaseClient<CampusDatabase>, scopeId: string) {
  const { data, error } = await client.rpc("enrollment_recent_imports", { p_scope_id: scopeId });
  if (error) throw databaseFailure(error.code);
  const parsed = recentImportsSchema.safeParse(data);
  if (!parsed.success) throw new ApplicationError("unexpected");
  return parsed.data;
}
