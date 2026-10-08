import { accountRoleSummary } from "@/lib/auth/account-labels";
import type { SessionView } from "@/modules/identity/schemas";

/** Display-only account information. Server policies remain the authorization boundary. */
export function campusAccountPresentation(session: SessionView | null) {
  const account = session?.authenticated ? session.account : null;
  const active = account?.status === "active";
  const name = session?.authenticated ? session.fullName?.trim() || "CampusOS account" : "CampusOS account";
  return {
    active,
    name,
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
    roleSummary: account?.assignments.length ? accountRoleSummary(account) : "Campus account",
    hasStaffAccess: Boolean(active && account?.assignments.length),
    canEnroll: Boolean(active && account?.assignments.some((assignment) => assignment.role === "enrollment_admin" && assignment.scope.kind === "institution")),
    securityLabel: session?.assurance === "aal2" ? "MFA verified for this session" : "Manage password & MFA",
  };
}
