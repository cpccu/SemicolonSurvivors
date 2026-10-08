import "server-only";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { configuredSiteOrigin, emailRolloutEnabled } from "@/lib/security/configuration";
import type { SessionView } from "./schemas";

export const unavailableReadiness: SessionView["readiness"] = {
  signInAvailable: false, emailAvailable: false, schema: "unavailable", email: "disabled",
};

export async function identityReadiness(): Promise<SessionView["readiness"]> {
  try {
    configuredSiteOrigin();
    const { data, error } = await createAdminDatabaseClient().rpc("identity_health");
    if (error || data !== "202610070001") return unavailableReadiness;
    const emailAvailable = emailRolloutEnabled();
    return { signInAvailable: true, emailAvailable, schema: "ready", email: emailAvailable ? "enabled" : "disabled" };
  } catch {
    return unavailableReadiness;
  }
}
