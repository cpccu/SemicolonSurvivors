import "server-only";
import { ApplicationError } from "@/lib/observability/errors";
import {
  readAiConfiguration, readBackendConfiguration, readPrivilegedKey,
  type BackendConfiguration,
} from "@/lib/validation/environment";

export function requireBackendConfiguration(): BackendConfiguration {
  const result = readBackendConfiguration(process.env);
  if (result.status !== "ready") throw new ApplicationError("configuration");
  return result.config;
}

export function getServerIntegrationConfiguration() {
  // Secret-bearing results stay behind a server-only import boundary.
  return {
    ai: readAiConfiguration(process.env),
    privilegedKey: readPrivilegedKey(process.env),
  };
}
