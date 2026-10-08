import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";

const mocks = vi.hoisted(() => ({ access: vi.fn(), identity: vi.fn(), session: vi.fn(), limit: vi.fn(), rollout: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/identity", () => ({ requireVerifiedIdentity: mocks.identity }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.limit }));
vi.mock("@/lib/security/configuration", () => ({ requireEmailRollout: mocks.rollout }));
vi.mock("./session-service", () => ({ getSessionView: mocks.session }));
vi.mock("./repository", async (original) => ({
  ...await original<typeof import("./repository")>(),
  databaseAccessRepository: () => ({ getAccessForUser: mocks.access }),
}));
import { confirmManagedLink, neutralResetMessage, requestPasswordReset, setPassword, signIn } from "./auth-service";

const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const auth = { signInWithPassword: vi.fn(), signOut: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn() };
const rpc = vi.fn();
// Only the exercised SDK surface is mocked; no provider network or Auth-user creation occurs.
const client = { auth, rpc } as unknown as SupabaseClient<CampusDatabase>;

beforeEach(() => {
  for (const mock of Object.values(auth)) mock.mockReset().mockResolvedValue({ data: {}, error: null });
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
  mocks.identity.mockResolvedValue({ userId, assurance: "aal1" });
  mocks.access.mockResolvedValue({ userId, status: "pending", assignments: [] });
  mocks.session.mockResolvedValue({ authenticated: true, account: { userId, status: "active", assignments: [] } });
  mocks.rollout.mockReturnValue("https://campus.example.invalid/auth/confirm");
});

describe("auth workflow gates (mocked provider)", () => {
  it("does not bind or activate after invalid managed confirmation", async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: { message: "sensitive token data" }, data: {} });
    await expect(confirmManagedLink(client, "a".repeat(64), "invite")).rejects.toMatchObject({ code: "authentication" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("signs out after a confirmed invitation fails the roster identity gate", async () => {
    auth.verifyOtp.mockResolvedValueOnce({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(confirmManagedLink(client, "a".repeat(64), "invite")).rejects.toMatchObject({ code: "authorization" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(rpc).not.toHaveBeenCalledWith("enrollment_complete_activation");
  });
  it("does not complete activation before successful managed password persistence", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { message: "provider password rejection" } });
    await expect(setPassword(client, "synthetic password only")).rejects.toMatchObject({ code: "validation" });
    expect(rpc).toHaveBeenCalledWith("enrollment_bind_identity");
    expect(rpc).not.toHaveBeenCalledWith("enrollment_complete_activation");
  });
  it("returns a completion failure rather than false success after the password is saved", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    await expect(setPassword(client, "synthetic password only")).rejects.toMatchObject({ code: "authorization" });
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("denies suspended/deactivated password changes before touching Auth", async () => {
    for (const status of ["suspended", "deactivated"]) {
      mocks.access.mockResolvedValueOnce({ userId, status, assignments: [] });
      await expect(setPassword(client, "synthetic password only")).rejects.toMatchObject({ code: "authorization" });
    }
    expect(auth.updateUser).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
  it("clears a newly issued login session when authoritative account access is denied", async () => {
    mocks.session.mockResolvedValueOnce({ authenticated: true, account: { status: "suspended" } });
    await expect(signIn(client, "synthetic@example.invalid", "existing password")).rejects.toMatchObject({ code: "authorization" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("keeps reset provider outcomes neutral without logging addresses, tokens, or provider errors", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: "sensitive provider text" } });
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await requestPasswordReset(client, "synthetic@example.invalid")).toEqual({ message: neutralResetMessage });
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith('{"event":"password_reset_exception","code":"unexpected"}');
  });
});
