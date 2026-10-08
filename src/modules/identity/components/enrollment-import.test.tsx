// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "../schemas";
import { EnrollmentImport } from "./enrollment-import";

const useSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/use-campus-session", () => ({ useCampusSession: useSession }));

const accountId = "b088c892-8f00-45c4-b5d4-d377672a01c0";
const batchId = "8b3b9b8d-d32c-46ec-94c1-70492d7a0ec2";
const readySession: SessionView = {
  authenticated: true,
  fullName: "Enrollment Admin",
  assurance: "aal2",
  account: { userId: accountId, status: "active", assignments: [{ role: "enrollment_admin", scope: { kind: "institution", id: accountId } }] },
  readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" },
};
const staged = { batchId, state: "staged" as const, records: [{ rowNumber: 1, studentId: "STU-001", email: "student@example.edu", fullName: "Sample Student", department: "Computer Science", batch: "2026", result: "new" as const, reason: null, rosterId: null, authStatus: "pending" as const, emailStatus: "not_required" as const }] };
const confirmed = { ...staged, state: "confirmed" as const };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("enrollment import access and workflow", () => {
  it("distinguishes signed-out and MFA-gated access without exposing source controls", () => {
    useSession.mockReturnValue({ session: null, loading: false, error: null });
    const { rerender } = render(<EnrollmentImport />);
    expect(screen.getByRole("alert").textContent).toContain("Sign in");
    expect(screen.queryByLabelText("Paste CSV source")).toBeNull();
    useSession.mockReturnValue({ ...readySession, session: { ...readySession, assurance: "aal1" }, loading: false });
    rerender(<EnrollmentImport />);
    expect(screen.getByRole("alert").textContent).toContain("authenticator verification");
    expect(screen.getByRole("link", { name: "Open account security" }).getAttribute("href")).toBe("/auth/security");
  });

  it("explains pending, inactive, and missing scoped-role states", () => {
    useSession.mockReturnValue({ session: { ...readySession, account: { ...readySession.account!, status: "pending" } }, loading: false, error: null });
    const { rerender } = render(<EnrollmentImport />);
    expect(screen.getByRole("alert").textContent).toContain("awaiting institutional approval");
    useSession.mockReturnValue({ session: { ...readySession, account: { ...readySession.account!, status: "suspended" } }, loading: false, error: null });
    rerender(<EnrollmentImport />);
    expect(screen.getByRole("alert").textContent).toContain("inactive");
    useSession.mockReturnValue({ session: { ...readySession, account: { ...readySession.account!, assignments: [] } }, loading: false, error: null });
    rerender(<EnrollmentImport />);
    expect(screen.getByRole("alert").textContent).toContain("institution-scoped enrollment administrator");
  });

  it("shows readable local validation and preserves the pasted source", async () => {
    useSession.mockReturnValue({ session: readySession, loading: false, error: null });
    render(<EnrollmentImport />);
    const source = screen.getByLabelText("Paste CSV source");
    const value = "studentId,email,fullName,department,batch\nSTU-001,nope,Sample Student,CS,2026";
    fireEvent.change(source, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Review source" }));
    await waitFor(() => expect(screen.getByText(/Row 2, email: Enter a valid email address/)).toBeDefined());
    expect((source as HTMLTextAreaElement).value).toBe(value);
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
  });

  it("allows roster-only confirmation when invitations are disabled and requires persisted confirmation", async () => {
    useSession.mockReturnValue({ session: readySession, loading: false, error: null });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(staged), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ report: confirmed, emailRequested: false, processingComplete: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<EnrollmentImport />);
    fireEvent.change(screen.getByLabelText("Paste CSV source"), { target: { value: "studentId,email,fullName,department,batch\nSTU-001,student@example.edu,Sample Student,CS,2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Review source" }));
    await screen.findByRole("button", { name: "Confirm approved roster" });
    expect(screen.getByText(/Invitation emails are disabled/)).toBeDefined();
    const confirm = screen.getByRole("button", { name: "Confirm approved roster" });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("roster was saved"));
    expect(screen.getByText("Saved roster outcomes")).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1]?.[1]?.body as string)).toEqual({ batchId, sendInvitations: false });
  });
});
