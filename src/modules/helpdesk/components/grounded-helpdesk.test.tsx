// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroundedHelpdesk } from "./grounded-helpdesk";

const campus = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@/components/layout/campus-context", () => ({ useCampus: () => campus }));
vi.mock("@/modules/content/use-live-query", () => ({ useContentSessionRevision: () => 0 }));

const sourceId = "b088c892-8f00-45c4-b5d4-d377672a01c0";
const answer = {
  available: true,
  reason: "ready",
  statements: [{ text: "Published events can be registered for from the event details page.", sourceId, quote: "Published events can be registered for from the event details page." }],
  sources: [{ id: sourceId, version: 3, title: "Event registration guidance", url: "/helpdesk?article=event" }],
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); campus.navigate.mockClear(); });

describe("Campus Decision Desk", () => {
  it("shows its decision flow, boundaries, and topic chips that fill the question", () => {
    render(<GroundedHelpdesk />);

    expect(screen.getByRole("heading", { name: "Answer. Evidence. Next step." })).toBeDefined();
    expect(screen.getByText("CAMPUS DECISION DESK")).toBeDefined();
    expect(screen.getByText("Ask", { selector: "strong" })).toBeDefined();
    expect(screen.getByText("Verify", { selector: "strong" })).toBeDefined();
    expect(screen.getByText("Act", { selector: "strong" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "What this can/cannot do" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Event registration" }));
    expect((screen.getByRole("textbox", { name: "Campus question" }) as HTMLInputElement).value).toBe("How do I register for a campus event?");
    expect((screen.getByRole("button", { name: "Ask with sources" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps consent as the gate, submits the existing payload, and labels verified evidence", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    render(<GroundedHelpdesk />);

    const question = "How do I register for a campus event?";
    fireEvent.change(screen.getByRole("textbox", { name: "Campus question" }), { target: { value: question } });
    const submit = screen.getByRole("button", { name: "Ask with sources" }) as HTMLButtonElement;
    fireEvent.click(submit);
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/helpdesk/answer");
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toEqual({ question, consent: true });
    expect(screen.getByRole("region", { name: "Campus decision answer" })).toBeDefined();
    expect(screen.getByText("Evidence-supported")).toBeDefined();
    expect(screen.getByText("1 approved source")).toBeDefined();
    expect(screen.getByText("Event registration guidance · Revision 3")).toBeDefined();
  });

  it("routes users to real modules without claiming an action completed", () => {
    render(<GroundedHelpdesk />);

    fireEvent.click(screen.getByRole("button", { name: /^Events/ }));
    expect(campus.navigate).toHaveBeenCalledWith("events");
    expect(screen.getByRole("region", { name: "Where to act next" }).textContent).toContain("nothing is submitted from this desk");
    expect(screen.getByRole("link", { name: /^Enrollment/ }).getAttribute("href")).toBe("/auth/enrollment");
  });
});
