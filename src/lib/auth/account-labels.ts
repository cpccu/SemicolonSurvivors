import type { AccountAccess } from "@/lib/authorization/models";

const roleLabels: Record<string, string> = {
  club_organizer: "Club organizer",
  academic_publisher: "Academic publisher",
  transport_editor: "Transport editor",
  support_staff: "Support staff",
  moderator: "Moderator",
  enrollment_admin: "Enrollment admin",
  system_admin: "System admin",
};

export function accountRoleSummary(account: AccountAccess): string {
  const labels = [...new Set(account.assignments.map((assignment) => roleLabels[assignment.role] ?? "Campus staff"))];
  return labels.length ? labels.join(" · ") : "Campus account";
}
