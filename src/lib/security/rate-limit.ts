import "server-only";
import { createHash } from "node:crypto";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { ApplicationError } from "@/lib/observability/errors";

type RateAction = "sign-in" | "reset" | "claim" | "confirm" | "password" | "enrollment";
const budgets: Record<RateAction, { limit: number; seconds: number }> = {
  "sign-in": { limit: 10, seconds: 900 }, reset: { limit: 3, seconds: 3600 },
  claim: { limit: 3, seconds: 3600 }, confirm: { limit: 8, seconds: 900 },
  password: { limit: 5, seconds: 900 }, enrollment: { limit: 20, seconds: 3600 },
};

export async function enforceRateLimit(action: RateAction, identity: string): Promise<void> {
  const admin = createAdminDatabaseClient();
  const budget = budgets[action];
  // Hash identifiers before persistence; global budgets also bound identifier-guessing attacks.
  const identifier = createHash("sha256").update(`${action}:${identity}`).digest("hex");
  for (const bucket of [
    { key: `${action}:${identifier}`, ...budget },
    { key: `${action}:global`, limit: 500, seconds: 3600 },
  ]) {
    const result = await admin.rpc("consume_rate_limit", {
      p_key: bucket.key, p_limit: bucket.limit, p_window_seconds: bucket.seconds,
    });
    if (result.error) throw new ApplicationError("configuration");
    if (result.data !== true) throw new ApplicationError("quota");
  }
}
