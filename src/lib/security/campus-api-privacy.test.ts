import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), assurance: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  signIn: vi.fn(), confirm: vi.fn(), reset: vi.fn(), claim: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database/request", () => ({
  createRequestDatabaseContext: () => ({
    client: {
      auth: { getUser: mocks.getUser, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } },
      rpc: mocks.rpc, from: mocks.from,
    },
    finalizeResponse(response: NextResponse) {
      response.cookies.set("synthetic-refresh", "preserved", { path: "/" });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    },
  }),
}));
vi.mock("@/modules/identity/readiness", () => ({
  identityReadiness: () => Promise.resolve({ signInAvailable: true, emailAvailable: true, schema: "ready", email: "enabled" }),
  unavailableReadiness: { signInAvailable: false, emailAvailable: false, schema: "unavailable", email: "disabled" },
}));
// Entry tests verify route dispatch/validation without invoking real providers.
vi.mock("@/modules/identity/auth-service", () => ({
  signIn: mocks.signIn, confirmManagedLink: mocks.confirm, requestPasswordReset: mocks.reset, setPassword: vi.fn(),
}));
vi.mock("@/modules/identity/invitation-service", () => ({ claimStudentAccount: mocks.claim }));

import { contentResponse } from "@/modules/content/server/http";
import { eventResponse } from "@/modules/events/server/http";
import { respond } from "@/modules/community/server/http";
import { GET as health } from "@/app/api/health/route";
import { GET as session } from "@/app/api/auth/session/route";
import { POST as signIn } from "@/app/api/auth/sign-in/route";
import { POST as confirm } from "@/app/api/auth/confirm/route";
import { POST as reset } from "@/app/api/auth/password-reset/route";
import { POST as claim } from "@/app/api/enrollment/claim/route";
import { GET as academics } from "@/app/api/academics/route";
import { GET as academic } from "@/app/api/academics/[id]/route";
import { GET as helpdesk } from "@/app/api/helpdesk/route";
import { GET as article } from "@/app/api/helpdesk/[id]/route";
import { GET as services } from "@/app/api/services/route";
import { GET as service } from "@/app/api/services/[id]/route";
import { GET as contentCapabilities } from "@/app/api/content/capabilities/route";
import { GET as resources } from "@/app/api/resources/route";
import { GET as resource } from "@/app/api/resources/[id]/route";
import { GET as resourcePreview } from "@/app/api/resources/[id]/preview/route";
import { GET as resourceDownload } from "@/app/api/resources/[id]/download/route";
import { GET as events } from "@/app/api/events/route";
import { GET as event } from "@/app/api/events/[eventId]/route";
import { GET as eventCapabilities } from "@/app/api/events/capabilities/route";
import { GET as ticket } from "@/app/api/events/[eventId]/ticket/route";
import { GET as directory } from "@/app/api/directory/route";
import { GET as directoryEntry } from "@/app/api/directory/[id]/route";
import { GET as preferences } from "@/app/api/directory/preferences/route";
import { GET as transport } from "@/app/api/transport/route";
import { GET as transportRoute } from "@/app/api/transport/[id]/route";
import { GET as items } from "@/app/api/lost-found/route";
import { GET as item } from "@/app/api/lost-found/[id]/route";
import { GET as complaints } from "@/app/api/complaints/route";
import { GET as complaint } from "@/app/api/complaints/[id]/route";
import { GET as offices } from "@/app/api/complaints/offices/route";
import { GET as administration } from "@/app/api/administration/route";
import { GET as media } from "@/app/api/community/media/[id]/route";
import { GET as imports } from "@/app/api/enrollment/imports/route";
import { GET as importReport } from "@/app/api/enrollment/imports/[batchId]/route";

const origin = "https://campus.example.invalid";
const id = "00000000-0000-4000-8000-000000000001";
const routeParams = { params: Promise.resolve({ id, eventId: id, batchId: id }) };
type ReadRoute = (request: NextRequest, context: typeof routeParams) => Promise<NextResponse>;
const campusReads: [string, ReadRoute][] = [
  ["academics", academics], ["academics/[id]", academic], ["helpdesk", helpdesk], ["helpdesk/[id]", article],
  ["services", services], ["services/[id]", service], ["content/capabilities", contentCapabilities],
  ["resources", resources], ["resources/[id]", resource], ["resources/[id]/preview", resourcePreview],
  ["resources/[id]/download", resourceDownload], ["events", events], ["events/[eventId]", event],
  ["events/capabilities", eventCapabilities], ["events/[eventId]/ticket", ticket],
  ["directory", directory], ["directory/[id]", directoryEntry], ["directory/preferences", preferences],
  ["transport", transport], ["transport/[id]", transportRoute], ["lost-found", items], ["lost-found/[id]", item],
  ["complaints", complaints], ["complaints/[id]", complaint], ["complaints/offices", offices],
  ["administration", administration], ["community/media/[id]", media],
  ["enrollment/imports", imports], ["enrollment/imports/[batchId]", importReport],
];
const boundaries = [
  ["content", (request: NextRequest, handler: () => Promise<unknown>, write = false) => contentResponse(request, handler, write)],
  ["events", (request: NextRequest, handler: () => Promise<unknown>, write = false) => eventResponse(request, handler, { write })],
  ["community", (request: NextRequest, handler: () => Promise<unknown>, write = false) => respond(request, handler, { write })],
] as const;

function post(path: string, body: unknown) {
  return new NextRequest(`${origin}/api/${path}`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("CAMPUS_SITE_URL", origin);
  vi.stubEnv("CAMPUS_E2E_PREVIEW", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://backend.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_fixture_only");
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  mocks.assurance.mockReset().mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
  mocks.rpc.mockReset().mockResolvedValue({ data: { userId: id, status: "active", assignments: [] }, error: null });
  mocks.from.mockReset();
  mocks.signIn.mockReset().mockResolvedValue({ nextStep: "signed_in" });
  mocks.confirm.mockReset().mockResolvedValue({ nextStep: "set_password" });
  mocks.reset.mockReset().mockResolvedValue({ message: "Neutral synthetic reset response" });
  mocks.claim.mockReset().mockResolvedValue({ message: "Neutral synthetic activation response" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("login-first campus API privacy", () => {
  it.each(campusReads)("denies anonymous GET /api/%s before reading campus data", async (path, route) => {
    const response = await route(new NextRequest(`${origin}/api/${path}`), routeParams);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "authentication", message: "Sign in to continue." } });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.cookies.get("synthetic-refresh")?.value).toBe("preserved");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(boundaries)("%s rejects anonymous writes before invoking the operation", async (_, boundary) => {
    const handler = vi.fn().mockResolvedValue({ private: "Synthetic campus record" });
    const response = await boundary(post("example", {}), handler, true);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(boundaries)("%s permits a verified active account to read", async (_, boundary) => {
    mocks.getUser.mockResolvedValue({ data: { user: { id, user_metadata: { status: "suspended", role: "system_admin" } } }, error: null });
    const handler = vi.fn().mockResolvedValue({ title: "Synthetic permitted record" });
    const response = await boundary(new NextRequest(`${origin}/api/example`), handler);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: "Synthetic permitted record" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each(boundaries)("%s rejects inactive authoritative accounts and invalid Auth", async (_, boundary) => {
    const handler = vi.fn().mockResolvedValue({ private: "Synthetic campus record" });
    for (const status of ["pending", "suspended", "deactivated"]) {
      mocks.getUser.mockResolvedValue({ data: { user: { id, user_metadata: { status: "active" } } }, error: null });
      mocks.rpc.mockResolvedValue({ data: { userId: id, status, assignments: [] }, error: null });
      expect((await boundary(new NextRequest(`${origin}/api/example`), handler)).status).toBe(403);
    }
    mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: { message: "Synthetic invalid session" } });
    expect((await boundary(new NextRequest(`${origin}/api/example`), handler)).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("anonymous health and account entry remain available", () => {
  it("returns health and anonymous session status", async () => {
    const healthResponse = health();
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ status: "ok", service: "campusos" });
    const sessionResponse = await session(new NextRequest(`${origin}/api/auth/session`));
    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({ authenticated: false, account: null, fullName: null, assurance: null });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("allows anonymous sign-in, confirmation, reset, and enrollment-claim dispatch", async () => {
    const entries = [
      [signIn, "auth/sign-in", { email: "student@example.invalid", password: "Synthetic password 123!" }, mocks.signIn],
      [confirm, "auth/confirm", { tokenHash: "a".repeat(64), type: "invite" }, mocks.confirm],
      [reset, "auth/password-reset", { email: "student@example.invalid" }, mocks.reset],
      [claim, "enrollment/claim", { studentId: "SYNTHETIC-001" }, mocks.claim],
    ] as const;
    for (const [route, path, input, operation] of entries) {
      expect((await route(post(path, input))).status).toBe(200);
      expect(operation).toHaveBeenCalledOnce();
    }
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
