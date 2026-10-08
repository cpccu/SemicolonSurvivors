"use client";

import type { z } from "zod";

export type IdentityRequestOptions = { signal?: AbortSignal; maxBytes?: number };

function boundedServerMessage(data: unknown, fallback: string) {
  const candidate = (data as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof candidate !== "string" || candidate.length === 0) return fallback;
  const safe = candidate.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return safe.length > 0 && safe.length <= 240 ? safe : fallback;
}

async function responseData(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { return null; }
}

export async function getIdentity<T>(path: string, schema: z.ZodType<T>, options: IdentityRequestOptions = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...(options.signal ? { signal: options.signal } : {}) });
  const data: unknown = await responseData(response);
  if (!response.ok) throw new Error(boundedServerMessage(data, "This information is not available to your account right now."));
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("The service returned an unexpected response.");
  return parsed.data;
}

export async function postIdentity<T>(path: string, body: unknown, schema: z.ZodType<T>, options: IdentityRequestOptions = {}): Promise<T> {
  const serialized = JSON.stringify(body);
  if (options.maxBytes !== undefined && new TextEncoder().encode(serialized).byteLength > options.maxBytes) {
    throw new Error(`This request is larger than ${options.maxBytes.toLocaleString()} UTF-8 bytes.`);
  }
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "same-origin", cache: "no-store", body: serialized, ...(options.signal ? { signal: options.signal } : {}),
  });
  const data: unknown = await responseData(response);
  if (!response.ok) {
    const failure = data as { error?: { message?: unknown } };
    throw new Error(typeof failure.error?.message === "string" ? failure.error.message : "This request could not be completed.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("The service returned an unexpected response.");
  return parsed.data;
}

export function notifySessionChanged() {
  window.dispatchEvent(new Event("campus-session-changed"));
}
