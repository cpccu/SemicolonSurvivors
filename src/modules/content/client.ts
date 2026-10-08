"use client";
import type { z } from "zod";

export async function contentFetch<T>(url: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  const request: RequestInit = { credentials: "same-origin", cache: "no-store" };
  if (options.method !== undefined) request.method = options.method;
  if (options.headers !== undefined) request.headers = options.headers;
  if (options.body !== undefined) request.body = options.body;
  if (options.signal !== undefined) request.signal = options.signal;
  const response = await fetch(url, request);
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = body as { error?: { message?: unknown } };
    throw new Error(typeof error.error?.message === "string" ? error.error.message : "This request could not be completed.");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new Error("The service returned an unexpected response. Refresh and try again.");
  return result.data;
}
export function jsonOptions(method: "POST" | "PATCH" | "DELETE", input: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) };
}
