import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

vi.mock("server-only", () => ({}));
import { readBoundedJson } from "@/lib/security/request";
import { configuredSiteOrigin, emailRolloutEnabled, requireEmailRollout } from "@/lib/security/configuration";

const bodySchema = z.strictObject({ value: z.string() });
function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/example", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", ...headers }, body,
  });
}

beforeEach(() => { vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("CAMPUS_SITE_URL", "http://localhost:3000/"); });
afterEach(() => vi.unstubAllEnvs());

describe("same-origin bounded JSON", () => {
  it("rejects cross-origin requests and incompatible content types", async () => {
    await expect(readBoundedJson(request('{"value":"ok"}', { origin: "https://attacker.invalid" }), bodySchema)).rejects.toMatchObject({ code: "authorization" });
    await expect(readBoundedJson(request('{"value":"ok"}', { "content-type": "text/plain" }), bodySchema)).rejects.toMatchObject({ code: "validation" });
    await expect(readBoundedJson(request('{"value":"ok"}', { origin: "" }), bodySchema)).rejects.toMatchObject({ code: "authorization" });
  });
  it("accepts the local 0.0.0.0 proxy alias only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const proxied = new NextRequest("http://0.0.0.0:3000/api/auth/example", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: '{"value":"ok"}',
    });
    await expect(readBoundedJson(proxied, bodySchema)).resolves.toEqual({ value: "ok" });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CAMPUS_SITE_URL", "https://campus.example/");
    const productionProxy = new NextRequest("http://0.0.0.0:3000/api/auth/example", {
      method: "POST", headers: { origin: "https://campus.example", "content-type": "application/json" }, body: '{"value":"ok"}',
    });
    await expect(readBoundedJson(productionProxy, bodySchema)).rejects.toMatchObject({ code: "authorization" });
  });
  it("counts streamed bytes even when content length understates the body", async () => {
    await expect(readBoundedJson(request(JSON.stringify({ value: "x".repeat(1000) }), { "content-length": "1" }), bodySchema, 100)).rejects.toMatchObject({ code: "validation" });
  });
  it("bounds multibyte input in bytes and redacts malformed payloads", async () => {
    await expect(readBoundedJson(request(JSON.stringify({ value: "界".repeat(100) })), bodySchema, 200)).rejects.toMatchObject({ code: "validation" });
    await expect(readBoundedJson(request("SECRET_NOT_JSON"), bodySchema)).rejects.toMatchObject({ code: "validation", message: "Check the information you entered." });
    expect(await readBoundedJson(request('{"value":"safe"}', { "content-type": "application/json; charset=utf-8" }), bodySchema)).toEqual({ value: "safe" });
  });
});

describe("callback origin and email rollout", () => {
  it("requires both explicit email rollout and SMTP verification flags", () => {
    vi.stubEnv("CAMPUS_AUTH_EMAIL_ENABLED", "true"); vi.stubEnv("CAMPUS_SMTP_VERIFIED", "false");
    expect(emailRolloutEnabled()).toBe(false);
    expect(() => requireEmailRollout()).toThrow("This service is not available yet.");
    vi.stubEnv("CAMPUS_SMTP_VERIFIED", "true");
    expect(requireEmailRollout()).toBe("http://localhost:3000/auth/confirm");
  });
  it("never accepts credentials, paths, or an insecure production callback origin", () => {
    for (const url of ["https://user:secret@example.invalid", "https://example.invalid/path", "https://example.invalid/?next=elsewhere"]) {
      vi.stubEnv("CAMPUS_SITE_URL", url); expect(() => configuredSiteOrigin()).toThrow("This service is not available yet.");
    }
    vi.stubEnv("CAMPUS_SITE_URL", "http://localhost:3000/"); vi.stubEnv("NODE_ENV", "production");
    expect(() => configuredSiteOrigin()).toThrow("This service is not available yet.");
  });
});
