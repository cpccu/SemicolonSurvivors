import { describe, expect, it } from "vitest";
import { checkInSchema, createEventSchema, eventIdSchema, eventListSchema, isSameOrigin, literalSearch } from "./validation";

const validEvent = {
  clubId: "b088c892-8f00-45c4-b5d4-d377672a01c0", title: "Campus workshop",
  description: "A practical campus workshop.", category: "Technology", venue: "Seminar room",
  startsAt: "2027-01-01T04:00:00Z", endsAt: "2027-01-01T06:00:00Z",
  registrationDeadline: "2026-12-31T18:00:00Z", capacity: 30, visibility: "campus",
};
describe("event request boundaries", () => {
  it("accepts an ordered, bounded event", () => expect(createEventSchema.safeParse(validEvent).success).toBe(true));
  it.each([
    { endsAt: validEvent.startsAt }, { registrationDeadline: validEvent.endsAt },
    { capacity: 0 }, { capacity: 10001 }, { title: "x".repeat(161) },
    { visibility: "private" }, { role: "club_organizer" },
  ])("rejects invalid event input %o", (change) => {
    expect(createEventSchema.safeParse({ ...validEvent, ...change }).success).toBe(false);
  });
  it("rejects synthetic fixture ids and non-token check-ins", () => {
    expect(eventIdSchema.safeParse("event-1").success).toBe(false);
    expect(checkInSchema.safeParse({ token: "student-id" }).success).toBe(false);
    expect(checkInSchema.safeParse({ token: validEvent.clubId, eventId: validEvent.clubId }).success).toBe(false);
  });
  it("bounds pagination and searches", () => {
    expect(eventListSchema.parse({}).limit).toBe(20);
    expect(eventListSchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(eventListSchema.safeParse({ page: "1001" }).success).toBe(false);
    expect(eventListSchema.safeParse({ query: "a".repeat(121) }).success).toBe(false);
    expect(literalSearch("100%_\\")).toBe("%100\\%\\_\\\\%");
  });
  it("requires the exact same origin for writes", () => {
    expect(isSameOrigin("https://campus.example", "https://campus.example/api/events", "same-origin")).toBe(true);
    for (const origin of [null, "null", "https://evil.example", "https://campus.example:444", "https://campus.example/evil", "https://user@campus.example", "https://campus.example?other=1", "https://campus.example#other"]) {
      expect(isSameOrigin(origin, "https://campus.example/api/events", "same-origin")).toBe(false);
    }
    expect(isSameOrigin("https://campus.example", "https://campus.example/api/events", "cross-site")).toBe(false);
  });
});
