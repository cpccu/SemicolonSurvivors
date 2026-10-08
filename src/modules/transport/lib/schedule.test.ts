import { describe, expect, it } from "vitest";
import { dhakaParts, formatCampusDate, nextSampleDeparture } from "./schedule";

describe("synthetic schedule, not an official timetable", () => {
  it("uses Asia/Dhaka rather than the host timezone", () => {
    expect(dhakaParts(new Date("2026-10-07T18:30:00Z"))).toEqual({ minutes: 30, weekday: "Thursday" });
    expect(formatCampusDate(new Date("2026-10-07T18:30:00Z"))).toMatch(/Thursday,? 8 October/);
  });

  it("finds a later departure on an operating day", () => {
    expect(nextSampleDeparture(new Date("2026-10-07T02:00:00Z"))).toMatchObject({ time: "09:15", day: "Today" });
  });

  it("does not advertise the departure minute after it has started", () => {
    expect(nextSampleDeparture(new Date("2026-10-07T03:15:00Z"))).toMatchObject({ time: "11:00", day: "Today" });
  });

  it("rolls forward after the last scheduled departure", () => {
    expect(nextSampleDeparture(new Date("2026-10-07T12:00:00Z"))).toMatchObject({ time: "07:30", day: "Tomorrow" });
  });

  it("skips the sample weekend operating exception", () => {
    expect(nextSampleDeparture(new Date("2026-10-09T03:00:00Z"))).toMatchObject({ time: "07:30", day: "Sunday" });
  });
});
