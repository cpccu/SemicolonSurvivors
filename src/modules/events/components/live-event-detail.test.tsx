// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveEventDetail } from "./live-event-detail";

vi.mock("@/lib/auth/browser", () => ({ createBrowserAuthClient: () => ({ auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }) }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
vi.mock("./private-ticket-qr", () => ({ PrivateTicketQr: () => <div>Local private QR ticket</div> }));

const eventId = "b088c892-8f00-45c4-b5d4-d377672a01c0";
const token = "8b3b9b8d-d32c-46ec-94c1-70492d7a0ec2";
const event = {
  id: eventId, club_id: "044a6cd5-0311-43c7-a28e-aa3e9433f8fd", title: "Campus workshop",
  description: "A campus workshop.", category: "Technology", venue: "Seminar room",
  starts_at: "2027-01-01T04:00:00Z", ends_at: "2027-01-01T06:00:00Z", registration_deadline: "2026-12-31T18:00:00Z",
  capacity: 30, visibility: "campus", status: "published", created_at: "2026-12-01T00:00:00Z", updated_at: "2026-12-01T00:00:00Z",
};
const ticket = {
  id: event.club_id, event_id: eventId, status: "registered", ticket_token: token,
  checked_in_at: null, queued_at: "2026-12-01T00:00:00Z", updated_at: "2026-12-01T00:00:00Z", waitlist_position: null,
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("private ticket session boundaries", () => {
  it("clears the previous user's ticket immediately and reloads after session changes", async () => {
    let requests = 0;
    let resolveNext: ((response: Response) => void) | undefined;
    const fetch = vi.fn(async (path: string) => {
      if (path.endsWith("/ticket")) {
        requests += 1;
        if (requests > 1) return new Promise<Response>((resolve) => { resolveNext = resolve; });
        return new Response(JSON.stringify({ ticket }), { status: 200 });
      }
      return new Response(JSON.stringify({ event, host: "Assigned club" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    render(<LiveEventDetail eventId={eventId} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(token)).toBeDefined());
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(screen.getByText(token)).toBeDefined();
    expect(requests).toBe(1);
    act(() => { window.dispatchEvent(new Event("campus-session-changed")); });
    expect(screen.queryByText(token)).toBeNull();
    expect(screen.queryByText("Local private QR ticket")).toBeNull();
    await waitFor(() => expect(requests).toBe(2));
    await act(async () => resolveNext?.(new Response(JSON.stringify({ error: { code: "authentication", message: "Sign in to continue." } }), { status: 401 })));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Sign in to continue."));
    expect(screen.queryByText(token)).toBeNull();
  });
});
