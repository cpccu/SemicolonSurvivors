"use client";
import { z } from "zod";

const failureSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export async function communityRequest<T>(url: string, schema: z.ZodType<T>, input?: { method?: string; data: unknown }, signal?: AbortSignal): Promise<T> {
  const init: RequestInit = { credentials: "same-origin", cache: "no-store" };
  if (signal) init.signal = signal;
  if (input) { init.method = input.method ?? "POST"; init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(input.data); }
  const response = await fetch(url, init);
  const result: unknown = await response.json();
  if (!response.ok) { const failure = failureSchema.safeParse(result); throw new Error(failure.success ? failure.data.error.message : "The request could not be completed."); }
  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new Error("The response is unavailable. Refresh and try again.");
  return parsed.data;
}
export const failureMessage = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed.";
export function campusTime(value: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export async function uploadPhoto(file: File, purpose: "item" | "complaint") {
  if (file.type !== "image/png" || file.size > 3 * 1024 * 1024) throw new Error("Choose a PNG image up to 3 MiB.");
  const response = await fetch("/api/community/media", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "image/png", "X-Campus-Media-Purpose": purpose }, body: file });
  const value: unknown = await response.json();
  if (!response.ok) { const failure = failureSchema.safeParse(value); throw new Error(failure.success ? failure.data.error.message : "The image could not be uploaded."); }
  return z.object({ mediaId: z.uuid() }).parse(value).mediaId;
}
