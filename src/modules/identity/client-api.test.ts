import { afterEach, describe, expect, it, vi } from "vitest";
import { getIdentity, postIdentity } from "./client-api";
import { z } from "zod";

afterEach(() => vi.unstubAllGlobals());

describe("identity client API", () => {
  it("uses a bounded, server-provided GET error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "This batch is no longer available." } }), { status: 401 })));
    await expect(getIdentity("/api/enrollment/imports/batch", z.never())).rejects.toThrow("This batch is no longer available.");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "x".repeat(241) } }), { status: 500 })));
    await expect(getIdentity("/api/enrollment/imports/batch", z.never())).rejects.toThrow("not available to your account");
  });

  it("checks the serialized UTF-8 body before making a bounded POST", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(postIdentity("/api/enrollment/imports/preview", { rows: ["é".repeat(100)] }, z.unknown(), { maxBytes: 100 })).rejects.toThrow("UTF-8 bytes");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates successful responses and passes abort signals through", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(postIdentity("/api/example", { ok: true }, z.strictObject({ saved: z.literal(true) }), { signal })).resolves.toEqual({ saved: true });
    expect(fetch.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ signal }));
  });
});
