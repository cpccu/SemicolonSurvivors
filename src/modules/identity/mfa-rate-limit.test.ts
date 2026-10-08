import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database/admin", () => ({ createAdminDatabaseClient: () => ({ rpc }) }));
import { enforceMfaRateLimit } from "./mfa-rate-limit";

const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
beforeEach(() => rpc.mockReset().mockResolvedValue({ data: true, error: null }));

describe("durable MFA budgets", () => {
  it("uses a single durable setup slot and persists only a hash of verified identity", async () => {
    await enforceMfaRateLimit("mfa-setup", userId);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "consume_rate_limit", { p_key: expect.stringMatching(/^mfa-setup:[a-f0-9]{64}$/), p_limit: 1, p_window_seconds: 300 });
    expect(rpc).toHaveBeenNthCalledWith(2, "consume_rate_limit", { p_key: "mfa-setup:global", p_limit: 500, p_window_seconds: 3600 });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(userId);
  });
  it("blocks when either persistent budget is denied", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(enforceMfaRateLimit("mfa-verify", userId)).rejects.toMatchObject({ code: "quota" });
    expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockClear().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    await expect(enforceMfaRateLimit("mfa-verify", userId)).rejects.toMatchObject({ code: "quota" });
  });
  it("fails closed with a stable error when the rate-limit RPC is unavailable", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "private_schema_detail" } });
    await expect(enforceMfaRateLimit("mfa-remove", userId)).rejects.toMatchObject({ code: "configuration", message: "This service is not available yet." });
  });
});
