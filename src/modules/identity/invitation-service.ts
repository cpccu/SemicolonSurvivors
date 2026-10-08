import "server-only";
import { z } from "zod";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { requireEmailRollout } from "@/lib/security/configuration";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { ApplicationError } from "@/lib/observability/errors";
import { databaseFailure } from "./repository";

const invitationLeaseSchema = z.strictObject({ rosterId: z.uuid(), leaseId: z.uuid(), email: z.email().max(254) });
export const neutralClaimMessage = "If your student record is eligible, activation instructions will be sent to its approved email. Contact enrollment if you need help.";

export async function deliverApprovedInvitation(studentId: string): Promise<void> {
  const redirectTo = requireEmailRollout();
  const admin = createAdminDatabaseClient();
  const begun = await admin.rpc("enrollment_begin_invitation", { p_student_id: studentId });
  if (begun.error) throw databaseFailure(begun.error.code);
  if (begun.data === null) return;
  const lease = invitationLeaseSchema.safeParse(begun.data);
  if (!lease.success) throw new ApplicationError("unexpected");
  let outcome: "sent" | "uncertain" = "uncertain";
  let userId: string | null = null;
  try {
    // The leased database identity is the only email source; callers cannot choose a destination.
    const invited = await admin.auth.admin.inviteUserByEmail(lease.data.email, { redirectTo });
    if (!invited.error && invited.data.user) { outcome = "sent"; userId = invited.data.user.id; }
  } catch {
    // A transport timeout may have sent an email; persist uncertainty and require reconciliation.
  }
  const finished = await admin.rpc("enrollment_finish_invitation", {
    p_roster_id: lease.data.rosterId, p_lease_id: lease.data.leaseId, p_user_id: userId, p_outcome: outcome,
  });
  if (finished.error) throw databaseFailure(finished.error.code);
  // Failure to bind a provider-created account remains an exception, never batch success.
  if (finished.data !== true) throw new ApplicationError("conflict");
}

export async function claimStudentAccount(studentId: string) {
  requireEmailRollout();
  await enforceRateLimit("claim", studentId);
  try {
    await deliverApprovedInvitation(studentId);
  } catch {
    // Keep existence/provider outcomes private; operators reconcile the durable roster exception.
    console.error(JSON.stringify({ event: "enrollment_claim_exception", code: "unexpected" }));
  }
  return { message: neutralClaimMessage };
}
