import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";
import { ApplicationError } from "@/lib/observability/errors";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/request-actor", () => ({ getRequestActor: mocks.actor }));
vi.mock("./mfa-rate-limit", () => ({ enforceMfaRateLimit: mocks.limit }));
import { challengeTotp, enrollTotp, getMfaState, removeTotp, verifyTotp } from "./mfa-service";

const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const factorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const challengeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const syntheticSecret = "JBSWY3DPEHPK3PXP";
const now = 1801962000;
const actor = { userId, status: "active", assignments: [], assurance: "aal1" };
const mfa = { listFactors: vi.fn(), enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn(), unenroll: vi.fn() };
const getClaims = vi.fn();
const signOut = vi.fn();
// The SDK is mocked; no Auth factor or user is created and no provider network is used.
const client = { auth: { mfa, getClaims, signOut } } as unknown as SupabaseClient<CampusDatabase>;
const factor = (status: "unverified" | "verified", id = factorId, type = "totp") => ({ id, friendly_name: "Synthetic authenticator", factor_type: type, status });
const list = (all: ReturnType<typeof factor>[]) => ({ data: { all }, error: null });

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now * 1000);
  mocks.actor.mockReset().mockResolvedValue(actor); mocks.limit.mockReset().mockResolvedValue(undefined);
  for (const mock of Object.values(mfa)) mock.mockReset();
  mfa.listFactors.mockResolvedValue(list([]));
  mfa.enroll.mockResolvedValue({ data: { id: factorId, type: "totp", totp: {
    secret: syntheticSecret, uri: `otpauth://totp/CampusOS:synthetic?secret=${syntheticSecret}`, qr_code: "unsupported geometry",
  } }, error: null });
  mfa.challenge.mockResolvedValue({ data: { id: challengeId, type: "totp", expires_at: now + 300 }, error: null });
  mfa.verify.mockResolvedValue({ data: { user: { id: userId }, access_token: "SYNTHETIC_TOKEN_NOT_A_CREDENTIAL" }, error: null });
  mfa.unenroll.mockResolvedValue({ data: { id: factorId }, error: null });
  getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: userId, aal: "aal2", amr: [{ method: "mfa/totp", timestamp: now }] } }, error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());

describe("managed TOTP orchestration", () => {
  it("requires authoritative active access before contacting MFA or limits", async () => {
    mocks.actor.mockRejectedValueOnce(new ApplicationError("authorization"));
    await expect(enrollTotp(client)).rejects.toMatchObject({ code: "authorization" });
    expect(mocks.limit).not.toHaveBeenCalled(); expect(mfa.listFactors).not.toHaveBeenCalled(); expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it("lists bounded factor metadata without secret, URI, JWT or QR fields", async () => {
    mfa.listFactors.mockResolvedValueOnce({ data: { all: [{ ...factor("verified"), secret: syntheticSecret }] }, error: null });
    const result = await getMfaState(client);
    expect(result).toEqual({ currentLevel: "aal1", freshMfa: false, canEnroll: false, hasOtherVerifiedFactors: false,
      factors: [{ id: factorId, friendlyName: "Synthetic authenticator", status: "verified" }] });
    expect(JSON.stringify(result)).not.toContain(syntheticSecret);
  });
  it("blocks new setup for both verified factors and unfinished setup", async () => {
    for (const status of ["verified", "unverified"] as const) {
      mfa.listFactors.mockResolvedValueOnce(list([factor(status)]));
      await expect(enrollTotp(client)).rejects.toMatchObject({ code: "conflict" });
    }
    expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it("never contacts enrollment when the persistent setup slot is denied", async () => {
    mocks.limit.mockRejectedValueOnce(new ApplicationError("quota"));
    await expect(enrollTotp(client)).rejects.toMatchObject({ code: "quota" });
    expect(mfa.listFactors).not.toHaveBeenCalled(); expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it("enrolls through the request client with deterministic naming and manual QR fallback", async () => {
    expect(await enrollTotp(client)).toEqual({ factorId, secret: syntheticSecret, qrCode: null });
    expect(mfa.enroll).toHaveBeenCalledExactlyOnceWith({ factorType: "totp", friendlyName: "CampusOS authenticator", issuer: "CampusOS" });
    expect(mocks.limit).toHaveBeenCalledWith("mfa-setup", userId);
    expect(mfa.verify).not.toHaveBeenCalled();
  });
  it("checks factor ownership before creating a challenge or verifying a code", async () => {
    mfa.listFactors.mockResolvedValue(list([factor("verified", otherId)]));
    await expect(challengeTotp(client, factorId)).rejects.toMatchObject({ code: "authorization" });
    await expect(verifyTotp(client, { factorId, challengeId, code: "012345" })).rejects.toMatchObject({ code: "authorization" });
    expect(mfa.challenge).not.toHaveBeenCalled(); expect(mfa.verify).not.toHaveBeenCalled();
  });
  it("permits challenges for owned verified or initial pending factors", async () => {
    for (const status of ["verified", "unverified"] as const) {
      mfa.listFactors.mockResolvedValueOnce(list([factor(status)]));
      expect(await challengeTotp(client, factorId)).toEqual({ factorId, challengeId, expiresAt: now + 300 });
    }
  });
  it("does not turn a pending factor into a bypass for other verified factors", async () => {
    mfa.listFactors.mockResolvedValue(list([factor("unverified"), factor("verified", otherId, "phone")]));
    await expect(challengeTotp(client, factorId)).rejects.toMatchObject({ code: "authorization" });
    await expect(verifyTotp(client, { factorId, challengeId, code: "012345" })).rejects.toMatchObject({ code: "authorization" });
    expect(mfa.verify).not.toHaveBeenCalled();
  });
  it("requires a fresh step-up before adding TOTP to an account protected by other MFA", async () => {
    mfa.listFactors.mockResolvedValue(list([factor("verified", otherId, "phone")]));
    await expect(enrollTotp(client)).rejects.toMatchObject({ code: "conflict" });
    expect(mfa.enroll).not.toHaveBeenCalled();
  });
  it("returns verified state only after SDK verification, reverified aal2 and verified factor status", async () => {
    mocks.actor.mockResolvedValueOnce(actor).mockResolvedValueOnce({ ...actor, assurance: "aal2" });
    mfa.listFactors.mockResolvedValueOnce(list([factor("unverified")])).mockResolvedValueOnce(list([factor("verified")]));
    const result = await verifyTotp(client, { factorId, challengeId, code: "012345" });
    expect(result.currentLevel).toBe("aal2"); expect(result.freshMfa).toBe(true);
    expect(mfa.verify).toHaveBeenCalledExactlyOnceWith({ factorId, challengeId, code: "012345" });
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_TOKEN");
  });
  it("does not report verification when the provider rejects or the session is still aal1", async () => {
    mfa.listFactors.mockResolvedValue(list([factor("unverified")]));
    mfa.verify.mockResolvedValueOnce({ data: null, error: { message: "PRIVATE_CODE_SECRET_PROVIDER_TEXT" } });
    await expect(verifyTotp(client, { factorId, challengeId, code: "012345" })).rejects.toMatchObject({ code: "authentication", message: "Sign in to continue." });
    await expect(verifyTotp(client, { factorId, challengeId, code: "012345" })).rejects.toMatchObject({ code: "authentication" });
  });
  it("rejects a successful verification response for another managed user", async () => {
    mfa.listFactors.mockResolvedValue(list([factor("unverified")]));
    mfa.verify.mockResolvedValueOnce({ data: { user: { id: otherId } }, error: null });
    await expect(verifyTotp(client, { factorId, challengeId, code: "012345" })).rejects.toMatchObject({ code: "authentication" });
  });
  it("does not claim completed verification if the managed factor remains unverified", async () => {
    mocks.actor.mockResolvedValueOnce(actor).mockResolvedValueOnce({ ...actor, assurance: "aal2" });
    mfa.listFactors.mockResolvedValue(list([factor("unverified")]));
    await expect(verifyTotp(client, { factorId, challengeId, code: "012345" })).rejects.toMatchObject({ code: "authentication" });
  });
  it("denies removal when the managed claim signature check fails", async () => {
    mocks.actor.mockResolvedValue({ ...actor, assurance: "aal2" });
    mfa.listFactors.mockResolvedValue(list([factor("verified")]));
    getClaims.mockResolvedValueOnce({ data: null, error: { message: "private signature detail" } });
    await expect(removeTotp(client, factorId, true)).rejects.toMatchObject({ code: "authentication" });
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });
  it("never removes on role alone, stale proof, missing confirmation or a foreign factor", async () => {
    mfa.listFactors.mockResolvedValue(list([factor("verified")]));
    mocks.actor.mockResolvedValue({ ...actor, assignments: [{ role: "system_admin" }] });
    await expect(removeTotp(client, factorId, true)).rejects.toMatchObject({ code: "authorization" });
    await expect(removeTotp(client, factorId, false)).rejects.toMatchObject({ code: "validation" });
    mocks.actor.mockResolvedValue({ ...actor, assurance: "aal2" });
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: userId, aal: "aal2", amr: [{ method: "totp", timestamp: now - 301 }] } }, error: null });
    await expect(removeTotp(client, factorId, true)).rejects.toMatchObject({ code: "authorization" });
    await expect(removeTotp(client, otherId, true)).rejects.toMatchObject({ code: "authorization" });
    expect(mfa.unenroll).not.toHaveBeenCalled(); expect(signOut).not.toHaveBeenCalled();
  });
  it("uses verified claims from the same subject for fresh proof", async () => {
    mocks.actor.mockResolvedValue({ ...actor, assurance: "aal2" });
    mfa.listFactors.mockResolvedValue(list([factor("verified")]));
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: otherId, aal: "aal2", amr: [{ method: "totp", timestamp: now }] } }, error: null });
    await expect(removeTotp(client, factorId, true)).rejects.toMatchObject({ code: "authorization" });
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });
  it("removes an owned factor only after fresh proof and then clears this session", async () => {
    mocks.actor.mockResolvedValue({ ...actor, assurance: "aal2" });
    mfa.listFactors.mockResolvedValue(list([factor("verified")]));
    expect(await removeTotp(client, factorId, true)).toEqual({ removed: true, signedOut: true });
    expect(mfa.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId });
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });
  it("does not claim signed-out completion when sign-out fails after removal", async () => {
    mocks.actor.mockResolvedValue({ ...actor, assurance: "aal2" });
    mfa.listFactors.mockResolvedValue(list([factor("verified")]));
    signOut.mockResolvedValueOnce({ error: { message: "private transport details" } });
    await expect(removeTotp(client, factorId, true)).rejects.toMatchObject({ code: "unexpected" });
    expect(mfa.unenroll).toHaveBeenCalledTimes(1);
  });
});
