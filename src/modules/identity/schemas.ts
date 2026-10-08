import { z } from "zod";
import { accountAccessSchema } from "@/lib/authorization/models";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const studentIdSchema = z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9-]+$/);
export const passwordSchema = z.string().min(12).max(128);
export const signInSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(128) });
export const resetSchema = z.strictObject({ email: emailSchema });
export const claimSchema = z.strictObject({ studentId: studentIdSchema });
export const confirmSchema = z.strictObject({
  tokenHash: z.string().min(32).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  type: z.enum(["invite", "recovery"]),
});
export const setPasswordSchema = z.strictObject({ password: passwordSchema });

export const rosterRowSchema = z.strictObject({
  studentId: studentIdSchema,
  email: emailSchema,
  fullName: z.string().trim().min(2).max(120),
  department: z.string().trim().min(1).max(100),
  batch: z.string().trim().min(1).max(40),
});
export const importPreviewSchema = z.strictObject({ rows: z.array(rosterRowSchema).min(1).max(50) });
export const importConfirmSchema = z.strictObject({
  batchId: z.uuid(), sendInvitations: z.boolean().default(false),
});
export const importReportSchema = z.strictObject({
  batchId: z.uuid(), state: z.enum(["staged", "confirmed"]),
  records: z.array(z.strictObject({
    rowNumber: z.number().int().positive(), studentId: studentIdSchema,
    email: emailSchema, fullName: z.string().min(2).max(120),
    department: z.string().min(1).max(100), batch: z.string().min(1).max(40),
    result: z.enum(["new", "unchanged", "conflict"]),
    reason: z.enum(["identity_conflict", "duplicate_in_batch"]).nullable(),
    rosterId: z.uuid().nullable(),
    authStatus: z.enum(["pending", "provisioned", "already_active", "conflict"]),
    emailStatus: z.enum(["not_requested", "in_flight", "sent", "failed", "uncertain", "not_required"]),
  })).max(50),
});

export const readinessSchema = z.strictObject({
  signInAvailable: z.boolean(), emailAvailable: z.boolean(),
  schema: z.enum(["ready", "unavailable"]), email: z.enum(["enabled", "disabled"]),
});
export const sessionSchema = z.strictObject({
  authenticated: z.boolean(), account: accountAccessSchema.nullable(),
  fullName: z.string().nullable(), assurance: z.enum(["aal1", "aal2"]).nullable(),
  readiness: readinessSchema,
});
export type SessionView = z.infer<typeof sessionSchema>;
export type RosterRow = z.infer<typeof rosterRowSchema>;
export type ImportReport = z.infer<typeof importReportSchema>;
export const recentImportsSchema = z.array(z.strictObject({
  batchId: z.uuid(), state: z.enum(["staged", "confirmed"]), createdAt: z.iso.datetime({ offset: true }),
})).max(10);
