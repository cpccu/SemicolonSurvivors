import { z } from "zod";
import { entityIdSchema } from "@/lib/validation/input";

export const accessScopeSchema = z.strictObject({
  kind: z.enum(["club", "department", "course", "section", "route", "office", "institution"]),
  id: entityIdSchema,
});

export type AccessScope = z.infer<typeof accessScopeSchema>;

const roles = [
  "club_organizer", "academic_publisher", "transport_editor", "support_staff",
  "moderator", "enrollment_admin", "system_admin",
] as const;

export type AuthorizationRole = typeof roles[number];

const roleScopes: Record<AuthorizationRole, readonly AccessScope["kind"][]> = {
  club_organizer: ["club"],
  academic_publisher: ["department", "course", "section"],
  transport_editor: ["route"],
  support_staff: ["office"],
  moderator: ["institution"],
  enrollment_admin: ["institution"],
  system_admin: ["institution"],
};

export const roleAssignmentSchema = z.strictObject({
  role: z.enum(roles),
  scope: accessScopeSchema,
}).refine((assignment) => roleScopes[assignment.role].includes(assignment.scope.kind), {
  message: "This role cannot be assigned to that scope.",
  path: ["scope"],
});

export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;

// Only an authoritative repository may supply this record; auth metadata is not an assignment source.
export const accountAccessSchema = z.strictObject({
  userId: entityIdSchema,
  status: z.enum(["active", "pending", "suspended", "deactivated"]),
  assignments: z.array(roleAssignmentSchema).max(100),
});

export type AccountAccess = z.infer<typeof accountAccessSchema>;
export type AuthorizationActor = Readonly<AccountAccess & { assurance: "aal1" | "aal2" }>;

export type DenialReason =
  | "authentication_required" | "account_inactive" | "mfa_required"
  | "scope_denied" | "ownership_denied" | "visibility_denied" | "unknown_action";

export type PolicyDecision = { allowed: true } | { allowed: false; reason: DenialReason };
