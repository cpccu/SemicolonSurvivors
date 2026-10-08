import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";
import { getRequestActor } from "@/lib/auth/request-actor";
import { ApplicationError } from "@/lib/observability/errors";
import { enrollmentScopeId, requireEmailRollout } from "@/lib/security/configuration";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { stageImport, confirmImport, importReport, recentImports } from "./repository";
import { deliverApprovedInvitation } from "./invitation-service";
import type { RosterRow } from "./schemas";

async function requireEnrollmentActor(client: SupabaseClient<CampusDatabase>, rateLimited = true) {
  const actor = await getRequestActor(client);
  const scopeId = enrollmentScopeId();
  if (actor.assurance !== "aal2" || !actor.assignments.some((a) =>
    a.role === "enrollment_admin" && a.scope.kind === "institution" && a.scope.id === scopeId)) {
    throw new ApplicationError("authorization");
  }
  if (rateLimited) await enforceRateLimit("enrollment", actor.userId);
  return scopeId;
}

export async function previewEnrollment(client: SupabaseClient<CampusDatabase>, rows: RosterRow[]) {
  const scopeId = await requireEnrollmentActor(client);
  return stageImport(client, scopeId, rows);
}

export async function confirmEnrollment(client: SupabaseClient<CampusDatabase>, batchId: string, sendInvitations: boolean) {
  const scopeId = await requireEnrollmentActor(client);
  if (sendInvitations) requireEmailRollout();
  const confirmed = await confirmImport(client, batchId, scopeId);
  let processingComplete = true;
  if (sendInvitations) {
    for (const record of confirmed.records) {
      if (record.result !== "conflict") {
        try { await deliverApprovedInvitation(record.studentId); }
        catch {
          processingComplete = false;
          console.error(JSON.stringify({ event: "enrollment_batch_exception", code: "unexpected" }));
          break;
        }
      }
    }
  }
  return { report: await importReport(client, batchId, scopeId), emailRequested: sendInvitations, processingComplete };
}

export async function getEnrollmentReport(client: SupabaseClient<CampusDatabase>, batchId: string) {
  return importReport(client, batchId, await requireEnrollmentActor(client, false));
}

export async function listRecentEnrollmentImports(client: SupabaseClient<CampusDatabase>) {
  return recentImports(client, await requireEnrollmentActor(client, false));
}
