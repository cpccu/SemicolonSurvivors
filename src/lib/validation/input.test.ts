import { describe, expect, it } from "vitest";
import { entityIdSchema, paginationSchema, searchInputSchema, validateInput } from "./input";

describe("request validation", () => {
  it("applies bounded pagination defaults and accepts numeric query strings", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationSchema.parse({ page: "2", limit: "50" })).toEqual({ page: 2, limit: 50 });
  });

  it.each([0, -1, 51, 1.5, "not-a-number", true, null, [1]])("rejects an invalid limit: %j", (limit) => {
    expect(paginationSchema.safeParse({ limit }).success).toBe(false);
  });

  it("rejects unbounded pages and unexpected input fields", () => {
    expect(paginationSchema.safeParse({ page: 10_001 }).success).toBe(false);
    expect(searchInputSchema.safeParse({ role: "system_admin" }).success).toBe(false);
  });

  it("trims search text and bounds its length", () => {
    expect(searchInputSchema.parse({ query: "  exam notices  " }).query).toBe("exam notices");
    expect(searchInputSchema.safeParse({ query: "x".repeat(121) }).success).toBe(false);
  });

  it("returns field errors for invalid input rather than throwing", () => {
    const result = validateInput(paginationSchema, { limit: 999 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.field).toBe("limit");
  });

  it("returns normalized data on valid input", () => {
    expect(validateInput(searchInputSchema, { query: "  library  " })).toEqual({
      success: true, data: { page: 1, limit: 20, query: "library" },
    });
  });

  it("rejects invalid authoritative entity IDs", () => {
    expect(entityIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success).toBe(true);
    expect(entityIdSchema.safeParse("client-supplied-name").success).toBe(false);
  });
});
