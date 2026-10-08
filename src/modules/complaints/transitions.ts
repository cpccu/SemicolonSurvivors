import type { LiveComplaint } from "@/modules/community/models";

export function complaintNextStates(state: LiveComplaint["state"], owner: boolean): LiveComplaint["state"][] {
  if (owner) {
    if (state === "resolved") return ["closed", "in_review"];
    if (state === "awaiting_student") return ["in_review", "escalated"];
    if (state === "received" || state === "in_review") return ["escalated"];
    return [];
  }
  if (state === "received" || state === "escalated") return ["in_review"];
  if (state === "in_review") return ["awaiting_student", "resolved", "escalated"];
  if (state === "awaiting_student") return ["in_review", "resolved", "escalated"];
  return [];
}
