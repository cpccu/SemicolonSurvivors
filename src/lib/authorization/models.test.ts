import { describe, expect, it } from "vitest";
import { accountAccessSchema, roleAssignmentSchema } from "./models";

const entityId = "00000000-0000-4000-8000-000000000001";

describe("authoritative access records", () => {
  it("accepts an active student with no privileged assignments", () => {
    expect(accountAccessSchema.safeParse({ userId: entityId, status: "active", assignments: [] }).success)
      .toBe(true);
  });

  it("rejects unknown roles and incompatible scopes", () => {
    expect(roleAssignmentSchema.safeParse({ role: "admin", scope: { kind: "institution", id: entityId } }).success)
      .toBe(false);
    expect(roleAssignmentSchema.safeParse({ role: "club_organizer", scope: { kind: "office", id: entityId } }).success)
      .toBe(false);
  });

  it("rejects client assurance and unsupported record fields", () => {
    expect(accountAccessSchema.safeParse({
      userId: entityId, status: "active", assignments: [], assurance: "aal2",
    }).success).toBe(false);
  });

  it("rejects missing status and invalid identifiers", () => {
    expect(accountAccessSchema.safeParse({ userId: entityId, assignments: [] }).success).toBe(false);
    expect(accountAccessSchema.safeParse({ userId: "student", status: "active", assignments: [] }).success)
      .toBe(false);
  });
});
