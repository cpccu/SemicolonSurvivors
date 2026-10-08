import { describe, expect, it } from "vitest";
import { accountRoleSummary } from "./account-labels";

const scope = { kind: "institution" as const, id: "9970bb2d-972a-4589-a59b-c41cd617b4c9" };

describe("account role summary", () => {
  it("does not infer student status from an absence of staff assignments", () => {
    expect(accountRoleSummary({ userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "active", assignments: [] })).toBe("Campus account");
  });

  it("labels authoritative staff assignments without exposing scope IDs", () => {
    expect(accountRoleSummary({
      userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "active",
      assignments: [
        { role: "system_admin", scope },
        { role: "enrollment_admin", scope },
      ],
    })).toBe("System admin · Enrollment admin");
  });
});
