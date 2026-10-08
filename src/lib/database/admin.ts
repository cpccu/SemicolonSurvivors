import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireBackendConfiguration, getServerIntegrationConfiguration } from "./configuration";
import type { CampusDatabase } from "./schema";
import { ApplicationError } from "@/lib/observability/errors";

export function createAdminDatabaseClient() {
  const backend = requireBackendConfiguration();
  const key = getServerIntegrationConfiguration().privilegedKey;
  if (key.status !== "ready") throw new ApplicationError("configuration");
  // This client never persists a session and must never be imported by browser components.
  return createClient<CampusDatabase>(backend.url, key.config, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
