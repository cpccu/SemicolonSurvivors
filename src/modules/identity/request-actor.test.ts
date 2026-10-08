import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";

vi.mock("server-only", () => ({}));
import { getRequestActor } from "@/lib/auth/request-actor";

const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherUser = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const getUser = vi.fn();
const assurance = vi.fn();
const rpc = vi.fn();
// This SDK fixture exercises the real resolver/repository; identity is not supplied by a client request.
const client = { auth: { getUser, mfa: { getAuthenticatorAssuranceLevel: assurance } }, rpc } as unknown as SupabaseClient<CampusDatabase>;

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: userId, user_metadata: { role: "system_admin" } } }, error: null });
  assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
  rpc.mockReset().mockResolvedValue({ data: { userId, status: "active", assignments: [] }, error: null });
});

describe("authoritative request actor", () => {
  it("never converts editable Auth metadata into roles or MFA assurance", async () => {
    expect(await getRequestActor(client)).toEqual({ userId, status: "active", assignments: [], assurance: "aal1" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("campus_access");
  });
  it("rejects a repository identity that does not match verified Auth", async () => {
    rpc.mockResolvedValueOnce({ data: { userId: otherUser, status: "active", assignments: [] }, error: null });
    await expect(getRequestActor(client)).rejects.toMatchObject({ code: "authorization" });
  });
  it("denies pending, suspended and deactivated profiles even when Auth has a valid session", async () => {
    for (const status of ["pending", "suspended", "deactivated"]) {
      rpc.mockResolvedValueOnce({ data: { userId, status, assignments: [] }, error: null });
      await expect(getRequestActor(client)).rejects.toMatchObject({ code: "authorization" });
    }
  });
  it("rejects unknown roles and invalid role/scope pairs from a malformed access record", async () => {
    for (const [role, kind] of [["root", "institution"], ["system_admin", "office"]]) {
      rpc.mockResolvedValueOnce({ data: { userId, status: "active", assignments: [{ role, scope: { kind, id: otherUser } }] }, error: null });
      await expect(getRequestActor(client)).rejects.toMatchObject({ code: "authorization" });
    }
  });
  it("fails closed when Auth verification fails, without querying access", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "private provider error" } });
    await expect(getRequestActor(client)).rejects.toMatchObject({ code: "authentication" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
