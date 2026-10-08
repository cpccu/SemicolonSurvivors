import { z } from "zod";

export type Environment = Readonly<Record<string, string | undefined>>;

export type ConfigurationResult<T> =
  | { status: "ready"; config: T }
  | { status: "unconfigured" }
  | { status: "invalid" };

function clean(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function validBackendUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (local && url.protocol === "http:"))
      && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === "/";
  } catch {
    return false;
  }
}

const backendConfigurationSchema = z.strictObject({
  url: z.string().max(2048).refine(validBackendUrl, "Use a secure backend origin."),
  publishableKey: z.string().max(4096).regex(/^sb_publishable_[A-Za-z0-9_-]{16,}$/),
});

export type BackendConfiguration = z.infer<typeof backendConfigurationSchema>;

export function readBackendConfiguration(environment: Environment): ConfigurationResult<BackendConfiguration> {
  if (environment.CAMPUS_E2E_PREVIEW === "true") return { status: "unconfigured" };
  const url = clean(environment.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = clean(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!url && !publishableKey) return { status: "unconfigured" };

  const result = backendConfigurationSchema.safeParse({ url, publishableKey });
  if (!result.success) return { status: "invalid" };

  const development = environment.NODE_ENV === "development" || environment.NODE_ENV === "test";
  if (!development && new URL(result.data.url).protocol !== "https:") {
    return { status: "invalid" };
  }

  return { status: "ready", config: result.data };
}

const privilegedKeySchema = z.string().max(4096).regex(/^sb_secret_[A-Za-z0-9_-]{16,}$/);

export function readPrivilegedKey(environment: Environment): ConfigurationResult<string> {
  const key = clean(environment.SUPABASE_SECRET_KEY);
  if (!key) return { status: "unconfigured" };
  const result = privilegedKeySchema.safeParse(key);
  return result.success ? { status: "ready", config: result.data } : { status: "invalid" };
}

const aiConfigurationSchema = z.strictObject({
  apiKey: z.string().min(20).max(4096),
  modelId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._/-]+$/),
});

export type AiConfiguration = z.infer<typeof aiConfigurationSchema>;
export type AiConfigurationResult = ConfigurationResult<AiConfiguration> | { status: "disabled" };

export function readAiConfiguration(environment: Environment): AiConfigurationResult {
  const enabled = clean(environment.CAMPUS_AI_ENABLED);
  if (!enabled || enabled === "false") return { status: "disabled" };
  if (enabled !== "true") return { status: "invalid" };

  const apiKey = clean(environment.GEMINI_API_KEY);
  const modelId = clean(environment.GEMINI_MODEL_ID);
  if (!apiKey || !modelId) return { status: "unconfigured" };
  const result = aiConfigurationSchema.safeParse({ apiKey, modelId });
  return result.success ? { status: "ready", config: result.data } : { status: "invalid" };
}
