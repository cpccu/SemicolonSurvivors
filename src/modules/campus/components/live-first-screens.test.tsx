// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DirectoryScreen } from "@/modules/directory/components/directory-screen";
import { EventsScreen } from "@/modules/events/components/events-screen";
import { AcademicsScreen } from "@/modules/academics/components/academics-screen";
import { ResourcesScreen } from "@/modules/resources/components/resources-screen";
import { HelpdeskScreen } from "@/modules/helpdesk/components/helpdesk-screen";
import { TransportScreen } from "@/modules/transport/components/transport-screen";
import { LostFoundScreen } from "@/modules/lost-found/components/lost-found-screen";
import { ComplaintsScreen } from "@/modules/complaints/components/complaints-screen";
import { AdministrationScreen } from "@/modules/administration/components/administration-screen";

vi.mock("@/components/layout/campus-context", () => ({
  useCampus: () => ({ filters: {}, setFilter: vi.fn() }),
}));
vi.mock("@/lib/auth/use-campus-session", () => ({
  useCampusSession: () => ({ session: { account: { status: "active" } } }),
}));
vi.mock("@/modules/campus/components/module-page-header", () => ({
  ModulePageHeader: ({ module, action, children, preview }: { module: string; action?: ReactNode; children?: ReactNode; preview?: boolean }) => <header data-testid={`header-${module}`} data-preview={String(preview)}>{action}{children}</header>,
}));
vi.mock("@/modules/community/components/live-shared", () => ({
  CommunityBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/modules/directory/components/live-directory", () => ({ LiveDirectory: () => <div data-testid="live-directory" /> }));
vi.mock("@/modules/events/components/live-events-collection", () => ({ LiveEventsCollection: () => <div data-testid="live-events" /> }));
vi.mock("@/modules/events/components/organizer-panel", () => ({ OrganizerPanel: () => <div data-testid="organizer-panel" /> }));
vi.mock("@/modules/content/components/live-content", () => ({ LiveContent: ({ kind }: { kind: string }) => <div data-testid={`live-content-${kind}`} /> }));
vi.mock("@/modules/resources/components/live-resources", () => ({ LiveResources: () => <div data-testid="live-resources" /> }));
vi.mock("@/modules/helpdesk/components/grounded-helpdesk", () => ({ GroundedHelpdesk: () => <div data-testid="campus-ai" /> }));
vi.mock("@/modules/transport/components/live-transport", () => ({ LiveTransport: () => <div data-testid="live-transport" /> }));
vi.mock("@/modules/lost-found/components/live-lost-found", () => ({
  LiveLostFound: ({ reportOpen }: { reportOpen?: boolean }) => <div data-testid="live-lost-found" data-report-open={String(reportOpen)} />,
}));
vi.mock("@/modules/complaints/components/live-complaints", () => ({ LiveComplaints: () => <div data-testid="live-complaints" /> }));
vi.mock("@/modules/administration/components/live-administration", () => ({ LiveAdministration: () => <div data-testid="live-administration" /> }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));

afterEach(cleanup);

describe("live-first module screens", () => {
  it.each([
    [DirectoryScreen, "directory", "live-directory"],
    [EventsScreen, "events", "live-events"],
    [AcademicsScreen, "academics", "live-content-notice"],
    [ResourcesScreen, "resources", "live-resources"],
    [HelpdeskScreen, "helpdesk", "campus-ai"],
    [TransportScreen, "transport", "live-transport"],
    [LostFoundScreen, "lost-found", "live-lost-found"],
    [ComplaintsScreen, "complaints", "live-complaints"],
    [AdministrationScreen, "administration", "live-administration"],
  ] as const)("mounts one live module surface for %s", (Screen, module, liveTestId) => {
    render(<Screen />);
    expect(screen.getByTestId(`header-${module}`).getAttribute("data-preview")).toBe("false");
    expect(screen.getByTestId(liveTestId)).toBeDefined();
    expect(screen.queryByText(/synthetic|demo material|sample collection/i)).toBeNull();
  });

  it("puts the source-grounded AI form before article browsing", () => {
    render(<HelpdeskScreen />);
    const ai = screen.getByTestId("campus-ai");
    const articles = screen.getByTestId("live-content-article");
    expect(Boolean(ai.compareDocumentPosition(articles) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("keeps the live lost-and-found report action at the module top", () => {
    render(<LostFoundScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Report an item" }));
    expect(screen.getByTestId("live-lost-found").getAttribute("data-report-open")).toBe("true");
  });

  it("keeps organizer controls live and exposes administration links", () => {
    render(<EventsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Organizer workspace" }));
    expect(screen.getByTestId("organizer-panel")).toBeDefined();

    cleanup();
    render(<AdministrationScreen />);
    expect(screen.getByRole("link", { name: "Enrollment" }).getAttribute("href")).toBe("/auth/enrollment");
    expect(screen.getByRole("link", { name: "Security" }).getAttribute("href")).toBe("/auth/security");
  });
});
