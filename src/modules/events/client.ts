import { z } from "zod";

const errorSchema = z.object({ error: z.object({ message: z.string().max(300), code: z.string() }) });
export async function eventRequest<T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/events${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const failure = errorSchema.safeParse(value);
    throw new Error(failure.success ? failure.data.error.message : "The event service is unavailable. Try again.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("The event service returned an unavailable result. Try again.");
  return parsed.data;
}

export function eventFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The event service is unavailable. Try again.";
}
export function eventTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}
