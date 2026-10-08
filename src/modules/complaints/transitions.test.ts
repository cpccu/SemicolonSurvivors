import { describe, expect, it } from "vitest";
import { complaintNextStates } from "./transitions";

describe("private complaint transitions", () => {
  it("keeps student and assigned-staff actions distinct", () => {
    expect(complaintNextStates("received", true)).toEqual(["escalated"]);
    expect(complaintNextStates("received", false)).toEqual(["in_review"]);
    expect(complaintNextStates("resolved", true)).toEqual(["closed", "in_review"]);
    expect(complaintNextStates("resolved", false)).toEqual([]);
  });
});
