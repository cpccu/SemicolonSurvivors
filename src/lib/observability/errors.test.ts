import { describe, expect, it } from "vitest";
import { ApplicationError, publicError, type ApplicationErrorCode } from "./errors";

describe("public error boundaries", () => {
  it("replaces unexpected internal details with a safe error", () => {
    const result = publicError(new Error("synthetic SQL details and token=private"));
    expect(result).toEqual({ code: "unexpected", status: 500, message: "Something went wrong. Please try again." });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  const codes: { code: ApplicationErrorCode; status: number }[] = [
    { code: "configuration", status: 503 }, { code: "validation", status: 400 },
    { code: "authentication", status: 401 }, { code: "authorization", status: 403 },
    { code: "conflict", status: 409 }, { code: "quota", status: 429 },
  ];

  it.each(codes)("keeps $code failures distinct", ({ code, status }) => {
    expect(publicError(new ApplicationError(code, { cause: new Error("synthetic private cause") })))
      .toMatchObject({ code, status });
    expect(JSON.stringify(publicError(new ApplicationError(code)))).not.toContain("cause");
  });
});
