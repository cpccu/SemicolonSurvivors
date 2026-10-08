import { describe, expect, it } from "vitest";
import { readAiConfiguration, readBackendConfiguration, readPrivilegedKey } from "./environment";

const backend = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_value_for_tests_only",
};

describe("backend configuration", () => {
  it("keeps absent or blank configuration unavailable", () => {
    expect(readBackendConfiguration({})).toEqual({ status: "unconfigured" });
    expect(readBackendConfiguration({ NEXT_PUBLIC_SUPABASE_URL: " " })).toEqual({ status: "unconfigured" });
  });

  it("accepts a complete HTTPS public configuration", () => {
    expect(readBackendConfiguration(backend)).toEqual({
      status: "ready",
      config: {
        url: backend.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey: backend.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
    });
  });

  it("rejects partial configuration without returning supplied values", () => {
    expect(readBackendConfiguration({ NEXT_PUBLIC_SUPABASE_URL: backend.NEXT_PUBLIC_SUPABASE_URL }))
      .toEqual({ status: "invalid" });
  });

  it.each([
    "not-a-url", "http://example.com", "https://name:password@example.com",
    "https://example.com/path", "https://example.com?token=synthetic", "https://example.com#fragment",
  ])("rejects an unsafe backend URL: %s", (url) => {
    expect(readBackendConfiguration({ ...backend, NEXT_PUBLIC_SUPABASE_URL: url })).toEqual({ status: "invalid" });
  });

  it("allows local HTTP only in an explicit non-production environment", () => {
    const local = { ...backend, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
    expect(readBackendConfiguration({ ...local, NODE_ENV: "development" }).status).toBe("ready");
    expect(readBackendConfiguration(local)).toEqual({ status: "invalid" });
    expect(readBackendConfiguration({ ...local, NODE_ENV: undefined })).toEqual({ status: "invalid" });
  });

  it("rejects a secret key in a public configuration slot", () => {
    expect(readBackendConfiguration({
      ...backend,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic_value_for_tests_only",
    })).toEqual({ status: "invalid" });
  });

  it("does not include privileged or AI inputs in public output", () => {
    const result = readBackendConfiguration({
      ...backend,
      SUPABASE_SECRET_KEY: "sb_secret_synthetic_value_for_tests_only",
      GEMINI_API_KEY: "synthetic-api-key-for-tests-only",
    });
    expect(JSON.stringify(result)).not.toContain("sb_secret_");
    expect(JSON.stringify(result)).not.toContain("synthetic-api-key");
  });
});

describe("optional server integrations", () => {
  it("keeps AI disabled even when credentials are present without explicit enablement", () => {
    expect(readAiConfiguration({ GEMINI_API_KEY: "synthetic-api-key-for-tests-only" }))
      .toEqual({ status: "disabled" });
    expect(readAiConfiguration({ CAMPUS_AI_ENABLED: "false" })).toEqual({ status: "disabled" });
  });

  it("requires both AI credentials and an explicitly selected model", () => {
    expect(readAiConfiguration({ CAMPUS_AI_ENABLED: "true" })).toEqual({ status: "unconfigured" });
    expect(readAiConfiguration({ CAMPUS_AI_ENABLED: "yes" })).toEqual({ status: "invalid" });
    expect(readAiConfiguration({
      CAMPUS_AI_ENABLED: "true", GEMINI_API_KEY: "synthetic-api-key-for-tests-only", GEMINI_MODEL_ID: "",
    })).toEqual({ status: "unconfigured" });
  });

  it("validates optional configuration without claiming provider availability", () => {
    expect(readAiConfiguration({
      CAMPUS_AI_ENABLED: "true",
      GEMINI_API_KEY: "synthetic-api-key-for-tests-only",
      GEMINI_MODEL_ID: "synthetic-test-model",
    }).status).toBe("ready");
  });

  it("keeps privileged credentials separate and validates their key class", () => {
    expect(readPrivilegedKey({})).toEqual({ status: "unconfigured" });
    expect(readPrivilegedKey({ SUPABASE_SECRET_KEY: backend.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }))
      .toEqual({ status: "invalid" });
    expect(readPrivilegedKey({ SUPABASE_SECRET_KEY: "sb_secret_synthetic_value_for_tests_only" }).status)
      .toBe("ready");
  });
});
