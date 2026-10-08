import "server-only";
import { createHash } from "node:crypto";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { ApplicationError } from "@/lib/observability/errors";

type MfaAction = "mfa-list" | "mfa-setup" | "mfa-challenge" | "mfa-verify" | "mfa-remove";
const budgets: Record<MfaAction, { limit: number; seconds: number }> = {
  "mfa-list": { limit: 60, seconds: 900 }, "mfa-setup": { limit: 1, seconds: 300 },
  "mfa-challenge": { limit: 8, seconds: 900 }, "mfa-verify": { limit: 8, seconds: 900 },
  "mfa-remove": { limit: 3, seconds: 900 },
};

export async function enforceMfaRateLimit(action: MfaAction, userId: string) {
  const admin = createAdminDatabaseClient();
  const hash = createHash("sha256").update(`${action}:${userId}`).digest("hex");
  const budget = budgets[action];
  for (const bucket of [
    { key: `${action}:${hash}`, ...budget },
    { key: `${action}:global`, limit: action === "mfa-list" ? 2000 : 500, seconds: 3600 },
  ]) {
    const result = await admin.rpc("consume_rate_limit", {
      p_key: bucket.key, p_limit: bucket.limit, p_window_seconds: bucket.seconds,
    });
    if (result.error) throw new ApplicationError("configuration");
    if (result.data !== true) throw new ApplicationError("quota");
  }
}
