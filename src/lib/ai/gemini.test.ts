import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { configuredAi } from "./gemini";
import type { Environment } from "@/lib/validation/environment";

const apiKey = "synthetic-api-key-for-tests-only";
const modelId = "synthetic-test-model";
const readyEnvironment: Environment = {
  CAMPUS_AI_ENABLED: "true",
  GEMINI_API_KEY: apiKey,
  GEMINI_MODEL_ID: modelId,
  CAMPUS_AI_PRIVACY_REVIEWED: "true",
  CAMPUS_AI_QUOTA_VERIFIED: "true",
  CAMPUS_AI_HELPDESK_ENABLED: "true",
  CAMPUS_AI_RESOURCE_SUMMARIES_ENABLED: "true",
};

describe("configured AI workflow gating", () => {
  it("returns null when AI is disabled", () => {
    expect(configuredAi({ ...readyEnvironment, CAMPUS_AI_ENABLED: "false" }, "helpdesk")).toBeNull();
  });

  it.each([
    ["CAMPUS_AI_PRIVACY_REVIEWED", "privacy review"],
    ["CAMPUS_AI_QUOTA_VERIFIED", "quota verification"],
  ] as const)("returns null when %s attestation is missing", (flag, _label) => {
    void _label;
    expect(configuredAi({ ...readyEnvironment, [flag]: undefined }, "helpdesk")).toBeNull();
  });

  it.each([
    ["helpdesk", "CAMPUS_AI_HELPDESK_ENABLED"],
    ["resource", "CAMPUS_AI_RESOURCE_SUMMARIES_ENABLED"],
  ] as const)("returns null when the selected %s workflow flag is missing", (workflow, flag) => {
    expect(configuredAi({ ...readyEnvironment, [flag]: undefined }, workflow)).toBeNull();
  });

  it.each([
    ["helpdesk", "CAMPUS_AI_HELPDESK_ENABLED"],
    ["resource", "CAMPUS_AI_RESOURCE_SUMMARIES_ENABLED"],
  ] as const)("returns the configured model for the %s workflow when required flags are true", (workflow, _flag) => {
    void _flag;
    expect(configuredAi(readyEnvironment, workflow)).toEqual({ apiKey, modelId });
  });
});
