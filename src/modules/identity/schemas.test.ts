import { describe, expect, it } from "vitest";
import { claimSchema, confirmSchema, importPreviewSchema, passwordSchema, resetSchema, signInSchema } from "./schemas";

const syntheticRow = { studentId: "syn-001", email: " SYNTHETIC@example.invalid ", fullName: "Synthetic Student", department: "Example", batch: "Demo" };

describe("identity request boundaries", () => {
  it("normalizes authoritative roster identity without accepting role or status assignments", () => {
    const parsed = importPreviewSchema.parse({ rows: [syntheticRow] });
    expect(parsed.rows[0]?.studentId).toBe("SYN-001");
    expect(parsed.rows[0]?.email).toBe("synthetic@example.invalid");
    for (const privileged of [{ role: "system_admin" }, { userId: "external-user" }, { status: "active" }]) {
      expect(importPreviewSchema.safeParse({ rows: [{ ...syntheticRow, ...privileged }] }).success).toBe(false);
    }
  });
  it("bounds roster batches and institutional identity strings", () => {
    expect(importPreviewSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(importPreviewSchema.safeParse({ rows: Array.from({ length: 51 }, () => syntheticRow) }).success).toBe(false);
    expect(importPreviewSchema.safeParse({ rows: [{ ...syntheticRow, fullName: "x".repeat(121) }] }).success).toBe(false);
  });
  it("does not let claim callers supply an email destination or a role", () => {
    expect(claimSchema.parse({ studentId: " syn-001 " })).toEqual({ studentId: "SYN-001" });
    expect(claimSchema.safeParse({ studentId: "SYN-001", email: "attacker@example.invalid" }).success).toBe(false);
    expect(claimSchema.safeParse({ studentId: "SYN-001", role: "enrollment_admin" }).success).toBe(false);
  });
  it("only accepts the supported managed confirmation token types", () => {
    const tokenHash = "a".repeat(64);
    expect(confirmSchema.safeParse({ tokenHash, type: "invite" }).success).toBe(true);
    expect(confirmSchema.safeParse({ tokenHash, type: "recovery" }).success).toBe(true);
    for (const type of ["signup", "email_change", "magiclink"]) {
      expect(confirmSchema.safeParse({ tokenHash, type }).success).toBe(false);
    }
    expect(confirmSchema.safeParse({ tokenHash, type: "invite", redirectTo: "https://example.invalid" }).success).toBe(false);
  });
  it("bounds passwords without rewriting password bytes", () => {
    expect(passwordSchema.parse(" leading and trailing ")).toBe(" leading and trailing ");
    expect(passwordSchema.safeParse("x".repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
    expect(signInSchema.safeParse({ email: "synthetic@example.invalid", password: "existing" }).success).toBe(true);
  });
  it("rejects metadata and reset redirect injection", () => {
    expect(signInSchema.safeParse({ email: "synthetic@example.invalid", password: "existing", metadata: { role: "system_admin" } }).success).toBe(false);
    expect(resetSchema.safeParse({ email: "synthetic@example.invalid", redirectTo: "https://example.invalid" }).success).toBe(false);
  });
});
