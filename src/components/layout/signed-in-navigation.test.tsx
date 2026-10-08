// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoleAssignment } from "@/lib/authorization/models";
import type { SessionView } from "@/modules/identity/schemas";
import { CampusContext, type CampusContextValue } from "./campus-context";
import { Sidebar } from "./navigation";
import { IntegrationDialog } from "./integration-dialog";

vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: { children: ReactNode }) => <section>{children}</section> }));

function session(assignments: RoleAssignment[] = [], status: "active" | "pending" = "active"): SessionView {
  return { authenticated: true, fullName: "Ayesha Rahman", account: { userId: "b088c892-8f00-45c4-b5d4-d377672a01c0", status, assignments }, assurance: "aal1", readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" } };
}

function context(accountSession: SessionView): CampusContextValue {
  return { session: accountSession, sessionLoading: false, sessionError: null, signOut: vi.fn(), active: "today", navigate: vi.fn(), openSearch: vi.fn(), openModules: vi.fn(), openAuth: vi.fn(), openDetail: vi.fn(), requireIntegration: vi.fn(), saved: [], toggleSaved: vi.fn(), filters: {}, setFilter: vi.fn() };
}

afterEach(cleanup);

describe("signed-in campus navigation", () => {
  it("shows the account identity and neutral role label without advertising staff access", () => {
    render(<CampusContext.Provider value={context(session())}><Sidebar /></CampusContext.Provider>);
    expect(screen.getByText("Ayesha Rahman")).toBeDefined();
    expect(screen.getByText("Campus account")).toBeDefined();
    expect(screen.queryByText(/student/i)).toBeNull();
    expect(screen.getByRole("link", { name: /account security/i }).getAttribute("href")).toBe("/auth/security");
    expect(screen.queryByRole("button", { name: "Staff workspace" })).toBeNull();
    expect(screen.queryByRole("link", { name: /enrollment import/i })).toBeNull();
  });

  it("offers enrollment and staff entry from authoritative active assignments", () => {
    const value = context(session([{ role: "enrollment_admin", scope: { kind: "institution", id: "11111111-1111-4111-8111-111111111111" } }]));
    render(<CampusContext.Provider value={value}><Sidebar /></CampusContext.Provider>);
    expect(screen.getByRole("link", { name: /enrollment import/i }).getAttribute("href")).toBe("/auth/enrollment");
    fireEvent.click(screen.getByRole("button", { name: "Staff workspace" }));
    expect(value.navigate).toHaveBeenCalledWith("administration");
  });

  it("does not infer enrollment permission from a system administrator role", () => {
    render(<CampusContext.Provider value={context(session([{ role: "system_admin", scope: { kind: "institution", id: "11111111-1111-4111-8111-111111111111" } }]))}><Sidebar /></CampusContext.Provider>);
    expect(screen.getByRole("button", { name: "Staff workspace" })).toBeDefined();
    expect(screen.queryByRole("link", { name: /enrollment import/i })).toBeNull();
  });

  it("preserves pending-account setup without exposing staff shortcuts", () => {
    render(<CampusContext.Provider value={context(session([{ role: "enrollment_admin", scope: { kind: "institution", id: "11111111-1111-4111-8111-111111111111" } }], "pending"))}><Sidebar /></CampusContext.Provider>);
    expect(screen.getByRole("link", { name: /finish account setup/i }).getAttribute("href")).toBe("/auth/password");
    expect(screen.queryByRole("button", { name: "Staff workspace" })).toBeNull();
    expect(screen.queryByRole("link", { name: /enrollment import/i })).toBeNull();
  });

  it("links active accounts to security from an unavailable preview action", () => {
    const value = context(session());
    render(<CampusContext.Provider value={value}><IntegrationDialog action="Sample resource upload" onClose={vi.fn()} /></CampusContext.Provider>);
    expect(screen.getByRole("link", { name: /account security/i }).getAttribute("href")).toBe("/auth/security");
    expect(value.openAuth).not.toHaveBeenCalled();
  });
});
