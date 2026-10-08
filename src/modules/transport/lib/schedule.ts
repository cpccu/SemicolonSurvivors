export const sampleDepartures = ["07:30", "09:15", "11:00", "13:15", "15:30", "17:00"] as const;
export const sampleStops = ["Campus gate", "Birulia", "Ashulia", "Uttara · Sector 10"];

export function dhakaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { minutes: Number(value("hour")) * 60 + Number(value("minute")), weekday: value("weekday") };
}

export function nextSampleDeparture(now: Date): { time: string; day: string; date: Date } {
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const { minutes, weekday } = dhakaParts(day);
    if (weekday === "Friday" || weekday === "Saturday") continue;
    const time = sampleDepartures.find((departure) => {
      const [hours = 0, mins = 0] = departure.split(":").map(Number);
      return dayOffset > 0 || hours * 60 + mins > minutes;
    });
    if (time) return { time, day: dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : weekday, date: day };
  }
  return { time: sampleDepartures[0], day: "Next operating day", date: now };
}

export function formatCampusDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" }).format(date);
}
