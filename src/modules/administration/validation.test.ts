import { describe, expect, it } from "vitest";
import { administrationClubInput, administrationLookupInput } from "./validation";

describe("administration input boundaries", () => {
  it("accepts bounded lookup terms and normalizes surrounding whitespace", () => {
    expect(administrationLookupInput.parse({ query: "  robotics  " })).toEqual({ query: "robotics" });
    expect(administrationLookupInput.parse({})).toEqual({ query: "" });
    expect(administrationLookupInput.safeParse({ query: "x".repeat(81) }).success).toBe(false);
  });

  it("requires a bounded club name and description", () => {
    expect(administrationClubInput.parse({ name: " Robotics Club ", description: "  Synthetic description  " })).toEqual({ name: "Robotics Club", description: "Synthetic description" });
    expect(administrationClubInput.safeParse({ name: "x", description: "" }).success).toBe(false);
    expect(administrationClubInput.safeParse({ name: "Valid Club", description: "x".repeat(5001) }).success).toBe(false);
  });
});
