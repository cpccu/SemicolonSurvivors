// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/modules/identity/schemas";
import { notifySessionChanged } from "@/modules/identity/client-api";
import { AccessEntry } from "./access-entry";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const anonymous: SessionView = {
  authenticated: false, account: null, fullName: null, assurance: null,
  readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" },
};
const active: SessionView = {
  ...anonymous, authenticated: true, assurance: "aal1",
  account: { userId: "0333fc74-9a72-453c-ac9b-5bb60f142684", status: "active", assignments: [] },
};
const response = (session: SessionView) => new Response(JSON.stringify(session), { status: 200 });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { navigation.refresh.mockClear(); });

describe("live privacy entry boundary", () => {
  it("never reveals a protected child to an anonymous session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(anonymous)));
    render(<AccessEntry initialSession={anonymous}><div>Protected campus content</div></AccessEntry>);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sign in to CampusOS" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("Protected campus content")).toBeNull();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("requests server-authorized content after sign-in and opens it only when supplied", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(anonymous)).mockResolvedValueOnce(response(active)); vi.stubGlobal("fetch", fetch);
    const page = render(<AccessEntry initialSession={anonymous} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sign in to CampusOS" }) as HTMLButtonElement).disabled).toBe(false));
    act(() => notifySessionChanged());
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("heading", { name: "Your campus is almost here." })).toBeDefined();
    expect(screen.queryByText("Protected campus content")).toBeNull();
    page.rerender(<AccessEntry initialSession={active}><div>Protected campus content</div></AccessEntry>);
    expect(screen.getByText("Protected campus content")).toBeDefined();
  });

  it("removes campus synchronously on session invalidation and keeps it removed after sign-out", async () => {
    let resolveSignOut: ((value: Response) => void) | undefined;
    const fetch = vi.fn().mockResolvedValueOnce(response(active)).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSignOut = resolve; })); vi.stubGlobal("fetch", fetch);
    render(<AccessEntry initialSession={active}><div>Protected campus content</div></AccessEntry>);
    await waitFor(() => expect(screen.getByText("Protected campus content")).toBeDefined());
    act(() => notifySessionChanged());
    expect(screen.queryByText("Protected campus content")).toBeNull();
    await act(async () => { resolveSignOut?.(response(anonymous)); });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome to your campus." })).toBeDefined());
    expect(screen.queryByText("Protected campus content")).toBeNull();
  });

  it("never reuses a previous account’s server content for another active account", async () => {
    const otherAccount: SessionView = { ...active, account: { ...active.account!, userId: "225ec965-a169-4099-9acf-f3a9c1fd4462" } };
    vi.stubGlobal("fetch", vi.fn(async () => response(otherAccount)));
    render(<AccessEntry initialSession={active}><div>Previous account’s content</div></AccessEntry>);
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByText("Previous account’s content")).toBeNull();
  });

  it("fails closed when a previously active session cannot be verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(<AccessEntry initialSession={active}><div>Protected campus content</div></AccessEntry>);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable"));
    expect(screen.queryByText("Protected campus content")).toBeNull();
  });

  it.each(["pending", "suspended", "deactivated"] as const)("keeps protected content hidden when live status becomes %s", async (status) => {
    const changed = { ...active, account: { ...active.account!, status } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(active)).mockResolvedValueOnce(response(changed)));
    render(<AccessEntry initialSession={active}><div>Protected campus content</div></AccessEntry>);
    await waitFor(() => expect(screen.getByText("Protected campus content")).toBeDefined());
    act(() => notifySessionChanged());
    await waitFor(() => expect(screen.getByRole("heading", { name: status === "pending" ? "One more step to get started." : "Campus access is denied." })).toBeDefined());
    expect(screen.queryByText("Protected campus content")).toBeNull();
  });
});
