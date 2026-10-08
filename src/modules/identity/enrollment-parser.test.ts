import { describe, expect, it } from "vitest";
import { enrollmentTemplate, parseEnrollmentCsv, parseEnrollmentJson, serializeEnrollmentPayload } from "./enrollment-parser";

function issues(result: ReturnType<typeof parseEnrollmentCsv>) {
  return result.ok ? [] : result.issues;
}

describe("enrollment source parser", () => {
  it("parses BOM-prefixed CSV with commas, newlines, and escaped quotes", () => {
    const result = parseEnrollmentCsv("\uFEFFstudentId,email,fullName,department,batch\nSTU-001,student@example.edu,\"Doe, \"\"Sam\"\"\nJr\",Computer Science,2026\n");
    expect(result).toEqual({ ok: true, rows: [{ studentId: "STU-001", email: "student@example.edu", fullName: "Doe, \"Sam\"\nJr", department: "Computer Science", batch: "2026" }] });
  });

  it("requires the exact header and gives row and field guidance", () => {
    const result = parseEnrollmentCsv("studentId,email,fullName,department,batch\nSTU-001,nope,Sample Student,CS,2026\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.row === 2 && issue.field === "email" && issue.message.includes("valid email"))).toBe(true);
    expect(issues(parseEnrollmentCsv("email,studentId,fullName,department,batch\n"))[0]?.message).toContain("exactly");
    expect(parseEnrollmentCsv("studentId,email,fullName,department,batch,extra\n").ok).toBe(false);
  });

  it("rejects oversized and over-quota imports before they can be posted", () => {
    const rows = Array.from({ length: 51 }, (_, index) => `STU-${String(index + 1).padStart(3, "0")},student${index}@example.edu,Sample Student,CS,2026`).join("\n");
    expect(issues(parseEnrollmentCsv(`studentId,email,fullName,department,batch\n${rows}\n`))[0]?.message).toContain("at most 50");
    expect(() => serializeEnrollmentPayload(Array.from({ length: 50 }, (_, index) => ({ studentId: `STU-${index + 1}`, email: `${"a".repeat(1000)}${index}@example.edu`, fullName: "Sample Student", department: "Computer Science", batch: "2026" })))).toThrow(/UTF-8 bytes/);
  });

  it("keeps JSON strict and never exposes a parser stack", () => {
    expect(issues(parseEnrollmentJson("{not json"))[0]?.message).toContain("valid JSON");
    const result = parseEnrollmentJson(JSON.stringify({ rows: [{ studentId: "STU-001", email: "bad", fullName: "Sample Student", department: "CS", batch: "2026" }] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.field === "email" && issue.message.includes("valid email"))).toBe(true);
    expect(parseEnrollmentJson(JSON.stringify({ rows: [], unexpected: true })).ok).toBe(false);
  });

  it("provides a clearly synthetic CSV template", () => {
    expect(enrollmentTemplate()).toContain("studentId,email,fullName,department,batch");
    expect(enrollmentTemplate()).toContain("Sample Student");
  });
});
