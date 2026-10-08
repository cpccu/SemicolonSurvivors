// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampusContext, type CampusContextValue } from "@/components/layout/campus-context";
import { AccountWorkspace, ActionsSummary, CampusQuickActions } from "./dashboard-panels";
import { CampusTimeline } from "./campus-timeline";
import { ActionsScreen } from "./actions-screen";
import { TodayScreen } from "./today-screen";

vi.mock("@/modules/transport/lib/use-campus-clock", () => ({ useCampusClock: () => new Date("2026-10-08T04:00:00Z") }));

function context(): CampusContextValue {
  return { session: { authenticated: true, fullName: "Campus Member", account: { userId: "b088c892-8f00-45c4-b5d4-d377672a01c0", status: "active", assignments: [] }, assurance: "aal1", readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" } }, sessionLoading: false, sessionError: null, signOut: vi.fn(), active: "today", navigate: vi.fn(), openSearch: vi.fn(), openModules: vi.fn(), openAuth: vi.fn(), openDetail: vi.fn(), requireIntegration: vi.fn(), saved: [], toggleSaved: vi.fn(), filters: {}, setFilter: vi.fn() };
}

afterEach(cleanup);

describe("signed-in dashboard entry points", () => {
  it("composes the named campus hub with account context and connected shortcuts", () => {
    render(<CampusContext.Provider value={context()}><TodayScreen /></CampusContext.Provider>);
    expect(screen.getByRole("heading", { level: 1, name: "My Campus Today." })).toBeDefined();
    expect(screen.getByText(/Campus workspace · connected data and actions/i)).toBeDefined();
    expect(screen.getByText("Asia/Dhaka · Campus time")).toBeDefined();
    expect(screen.getByRole("complementary", { name: "Account and campus tools" })).toBeDefined();
    expect(screen.queryByText(/student account|student preview|sign in to/i)).toBeNull();
  });

  it("opens existing modules directly from prominent quick actions", () => {
    const value = context();
    render(<CampusContext.Provider value={value}><CampusQuickActions /></CampusContext.Provider>);
    const quickActions = screen.getByRole("region", { name: "Start with a task" });
    fireEvent.click(within(quickActions).getByRole("button", { name: /read course changes/i }));
    expect(value.navigate).toHaveBeenCalledWith("academics");
    fireEvent.click(within(quickActions).getByRole("button", { name: /ask for private help/i }));
    expect(value.navigate).toHaveBeenCalledWith("complaints");
    expect(within(quickActions).getByRole("link", { name: /account security/i }).getAttribute("href")).toBe("/auth/security");
    expect(within(quickActions).queryByRole("button", { name: /staff workspace/i })).toBeNull();
  });

  it("shows real account context alongside honest bookmark state without sign-in prompts", () => {
    const value = context();
    render(<CampusContext.Provider value={value}><AccountWorkspace /><ActionsSummary /></CampusContext.Provider>);
    expect(screen.getByRole("heading", { name: "Campus Member" })).toBeDefined();
    expect(screen.getByText("Campus account")).toBeDefined();
    expect(screen.getByText(/Saved items last for this session/i)).toBeDefined();
    expect(screen.queryByText(/sign in to/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /explore events/i }));
    expect(value.navigate).toHaveBeenCalledWith("events");
    expect(value.openAuth).not.toHaveBeenCalled();
  });

  it("keeps timeline shortcuts connected to the live module routes", () => {
    const value = context();
    render(<CampusContext.Provider value={value}><CampusTimeline /></CampusContext.Provider>);
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByText(/Published notices, events, resources, and answers/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /check published notices/i }));
    expect(value.navigate).toHaveBeenCalledWith("academics");
    fireEvent.click(screen.getByRole("button", { name: /find something happening/i }));
    expect(value.navigate).toHaveBeenCalledWith("events");
  });

  it("routes an active account to connected workflows instead of asking it to sign in again", () => {
    const value = context();
    render(<CampusContext.Provider value={value}><ActionsScreen /></CampusContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Live workflows" }));
    expect(screen.getByText(/Open a connected workflow/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /support tickets/i }));
    expect(value.navigate).toHaveBeenCalledWith("complaints");
    expect(value.openAuth).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /account access/i })).toBeNull();
  });
});
