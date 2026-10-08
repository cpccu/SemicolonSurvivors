import "server-only";
import { createHash } from "node:crypto";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { ApplicationError } from "@/lib/observability/errors";

export async function enforceContentRate(action: "upload" | "ai" | "publish" | "resource-action", identity: string) {
  const key = action === "resource-action" ? action : `content-${action}`;
  const limit = action === "ai" ? 10 : action === "upload" ? 8 : 40;
  const digest = createHash("sha256").update(`${key}:${identity}`).digest("hex");
  const admin = createAdminDatabaseClient();
  for (const bucket of [{ id: digest, limit }, { id: "global", limit: action === "ai" ? 100 : 500 }]) {
    const result = await admin.rpc("consume_rate_limit", { p_key: `${key}:${bucket.id}`, p_limit: bucket.limit, p_window_seconds: 3600 });
    if (result.error) throw new ApplicationError("configuration");
    if (result.data !== true) throw new ApplicationError("quota");
  }
}
