import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/modules/identity/schemas";
import HomePage from "@/app/page";

const backend = vi.hoisted(() => ({ configuration: vi.fn(), createClient: vi.fn(), getSession: vi.fn() }));
vi.mock("@/lib/validation/environment", () => ({ readBackendConfiguration: backend.configuration }));
vi.mock("@/lib/database/server", () => ({ createServerDatabaseClient: backend.createClient }));
vi.mock("@/modules/identity/session-service", () => ({ getSessionView: backend.getSession }));
vi.mock("@/modules/identity/readiness", () => ({ unavailableReadiness: { signInAvailable: false, emailAvailable: false, schema: "unavailable", email: "disabled" } }));
vi.mock("./access-entry", () => ({ AccessEntry: ({ children }: { children: ReactNode }) => <main>CampusOS account gateway{children}</main> }));
vi.mock("@/components/layout/campus-shell", () => ({ CampusShell: ({ children }: { children: ReactNode }) => <aside>Campus sidebar{children}</aside> }));
vi.mock("@/modules/dashboard/components/today-screen", () => ({ TodayScreen: () => <section>Private Today content</section> }));
const anonymous: SessionView = {
  authenticated: false, account: null, fullName: null, assurance: null,
  readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" },
};
beforeEach(() => {
  backend.configuration.mockReturnValue({ status: "ready" });
  backend.createClient.mockResolvedValue("server-client");
  backend.getSession.mockResolvedValue(anonymous);
});

describe("server home-page privacy", () => {
  it("omits the campus tree entirely from an anonymous server response", async () => {
    const page = await HomePage();
    expect(page.props.children).toBeNull();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("CampusOS account gateway");
    expect(html).not.toContain("Campus sidebar");
    expect(html).not.toContain("Private Today content");
    expect(backend.getSession).toHaveBeenCalledWith("server-client");
  });
  it.each(["pending", "suspended", "deactivated"] as const)("does not serialize campus content for %s accounts", async (status) => {
    backend.getSession.mockResolvedValue({ ...anonymous, authenticated: true, account: { userId: "0333fc74-9a72-453c-ac9b-5bb60f142684", status, assignments: [] } });
    const page = await HomePage();
    expect(page.props.children).toBeNull();
    expect(renderToStaticMarkup(page)).not.toContain("Private Today content");
  });
  it("does not contact an unconfigured backend or serialize the campus tree", async () => {
    backend.configuration.mockReturnValue({ status: "unconfigured" });
    const page = await HomePage();
    expect(page.props.children).toBeNull();
    expect(backend.createClient).not.toHaveBeenCalled();
    expect(backend.getSession).not.toHaveBeenCalled();
  });
  it("fails closed on server verification failure", async () => {
    backend.getSession.mockRejectedValue(new Error("internal backend failure"));
    const page = await HomePage();
    expect(page.props.children).toBeNull();
    expect(page.props.initialError).toBe("Account access could not be verified. Please try again.");
    expect(renderToStaticMarkup(page)).not.toContain("internal backend failure");
  });
  it("constructs the campus tree only for an authoritative active session", async () => {
    backend.getSession.mockResolvedValue({ ...anonymous, authenticated: true, account: { userId: "0333fc74-9a72-453c-ac9b-5bb60f142684", status: "active", assignments: [] } });
    expect(renderToStaticMarkup(await HomePage())).toContain("Private Today content");
  });
});
