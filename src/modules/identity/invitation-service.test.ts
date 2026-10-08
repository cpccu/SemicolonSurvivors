import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invite: vi.fn(), rollout: vi.fn(), limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database/admin", () => ({ createAdminDatabaseClient: () => ({ rpc: mocks.rpc, auth: { admin: { inviteUserByEmail: mocks.invite } } }) }));
vi.mock("@/lib/security/configuration", () => ({ requireEmailRollout: mocks.rollout }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.limit }));
import { claimStudentAccount, deliverApprovedInvitation, neutralClaimMessage } from "./invitation-service";

const lease = { rosterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", leaseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "approved@example.invalid" };
const syntheticUser = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  mocks.rpc.mockReset(); mocks.invite.mockReset(); mocks.rollout.mockReset(); mocks.limit.mockReset();
  mocks.rollout.mockReturnValue("https://campus.example.invalid/auth/confirm");
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe("managed invitation orchestration (mock provider, no live email)", () => {
  it("does not contact Auth when no eligible lease exists, including retries or active accounts", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await claimStudentAccount("SYN-001")).toEqual({ message: neutralClaimMessage });
    expect(mocks.invite).not.toHaveBeenCalled();
  });
  it("uses only the authoritative leased email and stores the external outcome", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: lease, error: null });
    mocks.invite.mockResolvedValueOnce({ data: { user: { id: syntheticUser } }, error: null });
    await deliverApprovedInvitation("SYN-001");
    expect(mocks.invite).toHaveBeenCalledExactlyOnceWith(lease.email, { redirectTo: "https://campus.example.invalid/auth/confirm" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("enrollment_finish_invitation", {
      p_roster_id: lease.rosterId, p_lease_id: lease.leaseId, p_user_id: syntheticUser, p_outcome: "sent",
    });
  });
  it("records uncertainty after a timeout instead of automatically repeating a send", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: lease, error: null });
    mocks.invite.mockRejectedValueOnce(new Error("synthetic timeout with sensitive provider data"));
    await deliverApprovedInvitation("SYN-001");
    expect(mocks.invite).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenLastCalledWith("enrollment_finish_invitation", {
      p_roster_id: lease.rosterId, p_lease_id: lease.leaseId, p_user_id: null, p_outcome: "uncertain",
    });
  });
  it("never sends by merely having an admin credential when email rollout is disabled", async () => {
    mocks.rollout.mockImplementation(() => { throw new Error("This service is not available yet."); });
    await expect(deliverApprovedInvitation("SYN-001")).rejects.toThrow("This service is not available yet.");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.invite).not.toHaveBeenCalled();
  });
  it("preserves the neutral public response and redacts failure logs", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: lease, error: null }).mockResolvedValueOnce({ data: false, error: null });
    mocks.invite.mockResolvedValueOnce({ data: { user: { id: syntheticUser } }, error: null });
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await claimStudentAccount("SYN-001")).toEqual({ message: neutralClaimMessage });
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith('{"event":"enrollment_claim_exception","code":"unexpected"}');
  });
});
