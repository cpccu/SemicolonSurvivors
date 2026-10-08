import type { LiveRoute } from "@/modules/community/models";

export function dhakaDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function nextDeparture(route: Pick<LiveRoute, "schedules" | "exceptions">, now: Date) {
  if (!Number.isFinite(now.getTime())) return null;
  const midnight = new Date(`${dhakaDate(now)}T00:00:00+06:00`);
  for (let offset = 0; offset <= 120; offset += 1) {
    const day = new Date(midnight.getTime() + offset * 86_400_000);
    const date = dhakaDate(day);
    if (route.exceptions.some((exception) => exception.date === date && exception.cancelled)) continue;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const departures = route.schedules.filter((schedule) => schedule.days.includes(weekday)).map((schedule) => ({ date, time: schedule.time, scheduledAt: new Date(`${date}T${schedule.time}:00+06:00`).toISOString() })).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const next = departures.find((departure) => Date.parse(departure.scheduledAt) > now.getTime());
    if (next) return next;
  }
  return null;
}
export const operatingDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
