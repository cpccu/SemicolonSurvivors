// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent } from "../models";
import { createTicketQrPayload } from "../ticket-code";
import { OrganizerCheckIn } from "./organizer-check-in";

const eventId = "b088c892-8f00-45c4-b5d4-d377672a01c0";
const token = "8b3b9b8d-d32c-46ec-94c1-70492d7a0ec2";
const event: LiveEvent = {
  id: eventId, club_id: "044a6cd5-0311-43c7-a28e-aa3e9433f8fd", title: "Campus workshop",
  description: "A campus workshop.", category: "Technology", venue: "Seminar room",
  starts_at: "2027-01-01T04:00:00Z", ends_at: "2027-01-01T06:00:00Z",
  registration_deadline: "2026-12-31T18:00:00Z", capacity: 30, visibility: "campus",
  status: "published", created_at: "2026-12-01T00:00:00Z", updated_at: "2026-12-01T00:00:00Z",
};
function pasteAndReview(value: string) {
  fireEvent.change(screen.getByLabelText("Decoded QR payload or manual ticket code"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Review ticket" }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("organizer decode-first check-in", () => {
  it("does not dispatch on decode, rejects wrong-event tickets, and never navigates malicious input", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<OrganizerCheckIn events={[event]} />);
    pasteAndReview(createTicketQrPayload(event.club_id, token));
    expect(screen.getByRole("alert").textContent).toContain("different event");
    expect(screen.queryByRole("button", { name: "Record check-in" })).toBeNull();
    pasteAndReview(`https://evil.example/?token=${token}`);
    expect(screen.getByRole("alert").textContent).toContain("complete CampusOS ticket");
    expect(window.location.href).toBe("http://localhost:3000/");
    pasteAndReview(createTicketQrPayload(eventId, token));
    expect(screen.getByRole("button", { name: "Record check-in" })).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation, sends the token only in POST JSON, and bounds duplicate clicks", async () => {
    let finish: ((response: Response) => void) | undefined;
    const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<OrganizerCheckIn events={[event]} />);
    pasteAndReview(createTicketQrPayload(eventId, token));
    const button = screen.getByRole("button", { name: "Record check-in" });
    fireEvent.click(button); fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual([`/api/events/${eventId}/checkin`, expect.objectContaining({ method: "POST", body: JSON.stringify({ token }) })]);
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain(token);
    await act(async () => { finish?.(new Response(JSON.stringify({ already_checked_in: true, checked_in_at: "2027-01-01T04:00:00Z" }), { status: 200 })); });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Ticket was already checked in"));
    expect(screen.queryByRole("button", { name: "Record check-in" })).toBeNull();
  });
  it("preserves exact safe API invalid-ticket feedback for manual entry", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: "not_found", message: "This event or ticket is not available." } }), { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    render(<OrganizerCheckIn events={[event]} />);
    pasteAndReview(token);
    expect(screen.getByText(/Manual codes do not encode an event/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Record check-in" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("This event or ticket is not available."));
    expect(screen.getByRole("alert").textContent).not.toContain(token);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("aborts an in-flight request when the organizer view closes", () => {
    const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    const view = render(<OrganizerCheckIn events={[event]} />);
    pasteAndReview(token); fireEvent.click(screen.getByRole("button", { name: "Record check-in" }));
    const signal = fetch.mock.calls[0]?.[1].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
