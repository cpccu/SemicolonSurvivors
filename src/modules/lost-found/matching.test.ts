import { describe, expect, it } from "vitest";
import { suggestMatches } from "./matching";
import type { LiveItem } from "@/modules/community/models";

const item = (overrides: Partial<LiveItem>): LiveItem => ({
  id: "11111111-1111-4111-8111-111111111111", owner_id: "21111111-1111-4111-8111-111111111111", kind: "lost", title: "Blue water bottle",
  description: "Blue metal bottle with silver cap", location: "Library entrance", occurred_on: "2026-10-06", photo_id: "31111111-1111-4111-8111-111111111111", state: "open", version: 1, created_at: "2026-10-06T00:00:00Z", updated_at: "2026-10-06T00:00:00Z", ...overrides,
});

describe("lost and found explainable suggestions", () => {
  it("returns only opposite-kind, open candidates with reasons", () => {
    const match = item({ id: "41111111-1111-4111-8111-111111111111", kind: "found", title: "Blue metal bottle", description: "Blue metal bottle with silver cap", location: "Library entrance", occurred_on: "2026-10-06" });
    const sameKind = item({ id: "51111111-1111-4111-8111-111111111111", kind: "lost" });
    const closed = item({ id: "61111111-1111-4111-8111-111111111111", kind: "found", state: "resolved" });
    const results = suggestMatches(item({}), [match, sameKind, closed]);
    expect(results).toHaveLength(1);
    expect(results[0]?.reasons).toEqual(expect.arrayContaining(["Same reported location", "Dates within three days"]));
  });
});
