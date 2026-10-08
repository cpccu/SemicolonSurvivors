// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampusContext, type CampusContextValue } from "@/components/layout/campus-context";
import { ModulePageHeader } from "./module-page-header";
import { ModuleWorkspace } from "./module-workspace";

function contextValue(overrides: Partial<CampusContextValue> = {}): CampusContextValue {
  return {
    session: null,
    sessionLoading: false,
    sessionError: null,
    signOut: vi.fn(async () => undefined),
    active: "events",
    navigate: vi.fn(),
    openSearch: vi.fn(),
    openModules: vi.fn(),
    openAuth: vi.fn(),
    openDetail: vi.fn(),
    requireIntegration: vi.fn(),
    saved: [],
    toggleSaved: vi.fn(),
    filters: {},
    setFilter: vi.fn(),
    ...overrides,
  };
}

describe("campus module presentation", () => {
  it("keeps the live boundary visible without marking a real module as demo content", () => {
    render(<ModulePageHeader module="events" preview={false}>Private event records require an active account.</ModulePageHeader>);

    expect(screen.getByRole("heading", { name: "Clubs & events." })).toBeDefined();
    expect(screen.getByText("Live campus data")).toBeDefined();
    expect(screen.queryByText("Demo material")).toBeNull();
    expect(screen.getByText("Private event records require an active account.")).toBeDefined();
    expect(screen.getByRole("link", { name: /Data boundary/ }).getAttribute("href")).toBe("#module-events-access");
  });

  it("keeps the mounted module frame actions connected to campus navigation", () => {
    const openModules = vi.fn();
    const navigate = vi.fn();
    render(
      <CampusContext.Provider value={contextValue({ openModules, navigate })}>
        <ModuleWorkspace module="events"><p>Live records remain mounted here.</p></ModuleWorkspace>
      </CampusContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Module map" }));
    fireEvent.click(screen.getByRole("button", { name: /Transport/ }));
    expect(openModules).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("transport");
    expect(screen.getByText("Live records remain mounted here.")).toBeDefined();
  });
});
