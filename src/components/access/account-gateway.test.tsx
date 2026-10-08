// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/modules/identity/schemas";
import { AccountGateway } from "./account-gateway";

const anonymous: SessionView = {
  authenticated: false, account: null, fullName: null, assurance: null,
  readiness: { signInAvailable: true, emailAvailable: true, schema: "ready", email: "enabled" },
};
function gateway(session = anonymous) {
  const onSignOut = vi.fn(async () => undefined);
  const onRetry = vi.fn();
  render(<AccountGateway session={session} onSignOut={onSignOut} onRetry={onRetry} />);
  return { onSignOut, onRetry };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("private campus account gateway", () => {
  it("uses the existing sign-in endpoint, normalizes the email, and announces the session change", async () => {
    const active: SessionView = { ...anonymous, authenticated: true, assurance: "aal1", account: { userId: "0333fc74-9a72-453c-ac9b-5bb60f142684", status: "active", assignments: [] } };
    const fetch = vi.fn(async () => new Response(JSON.stringify(active), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const changed = vi.fn(); window.addEventListener("campus-session-changed", changed);
    gateway();
    fireEvent.change(screen.getByLabelText("Approved email address"), { target: { value: "STUDENT@CAMPUS.EDU" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "existing-account-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to CampusOS" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith("/api/auth/sign-in", expect.objectContaining({ method: "POST", credentials: "same-origin", cache: "no-store", body: JSON.stringify({ email: "student@campus.edu", password: "existing-account-password" }) }));
    expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("combobox")).toBeNull();
    window.removeEventListener("campus-session-changed", changed);
  });

  it("honestly disables activation and reset when email rollout is disabled while retaining sign-in", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    gateway({ ...anonymous, readiness: { ...anonymous.readiness, emailAvailable: false, email: "disabled" } });
    expect((screen.getByRole("button", { name: "Sign in to CampusOS" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Activation & reset email disabled")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));
    const activation = screen.getByRole("button", { name: "Request activation instructions" }) as HTMLButtonElement;
    expect(activation.disabled).toBe(true);
    fireEvent.click(activation);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect((screen.getByRole("button", { name: "Request reset instructions" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when account services are unavailable, including forced form submissions", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    gateway({ ...anonymous, readiness: { signInAvailable: false, emailAvailable: false, schema: "unavailable", email: "disabled" } });
    expect(screen.getByText("Account sign-in unavailable")).toBeDefined();
    expect((screen.getByLabelText("Approved email address") as HTMLInputElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Sign in to CampusOS" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates roster IDs before posting and keeps activation responses neutral", async () => {
    const message = "If this record is eligible, instructions will be sent to its approved email.";
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    gateway(); fireEvent.click(screen.getByRole("button", { name: "Activate account" }));
    fireEvent.change(screen.getByLabelText("Student ID"), { target: { value: "bad id!" } });
    fireEvent.submit(screen.getByRole("form", { name: "Activate an approved campus account" }));
    expect(screen.getByRole("alert").textContent).toContain("valid student ID");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Student ID"), { target: { value: " cu-123 " } });
    fireEvent.submit(screen.getByRole("form", { name: "Activate an approved campus account" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(message));
    expect(fetch).toHaveBeenCalledWith("/api/enrollment/claim", expect.objectContaining({ body: JSON.stringify({ studentId: "CU-123" }) }));
    expect(screen.queryByText(/account created/i)).toBeNull();
  });

  it("bounds duplicate submissions and displays safe service errors", async () => {
    let finish: ((response: Response) => void) | undefined;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })); vi.stubGlobal("fetch", fetch);
    gateway();
    fireEvent.change(screen.getByLabelText("Approved email address"), { target: { value: "student@campus.edu" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "password" } });
    const form = screen.getByRole("form", { name: "Sign in to CampusOS" });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => { finish?.(new Response(JSON.stringify({ error: { message: "Access could not be verified." } }), { status: 403 })); });
    expect(screen.getByRole("alert").textContent).toBe("Access could not be verified.");
    expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("");
  });

  it("requests password reset through the existing endpoint and shows its neutral message", async () => {
    const message = "If this address is eligible, password reset instructions will be sent to its approved email.";
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    gateway(); fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Approved email address"), { target: { value: "STUDENT@CAMPUS.EDU" } });
    fireEvent.click(screen.getByRole("button", { name: "Request reset instructions" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(message));
    expect(fetch).toHaveBeenCalledWith("/api/auth/password-reset", expect.objectContaining({ body: JSON.stringify({ email: "student@campus.edu" }) }));
  });

  it("explains a denied sign-in when the auth service rejects an inactive account", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: "authorization", message: "This action is not available to your account." } }), { status: 403 })); vi.stubGlobal("fetch", fetch);
    gateway();
    fireEvent.change(screen.getByLabelText("Approved email address"), { target: { value: "student@campus.edu" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to CampusOS" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Campus access is denied for this account."));
    expect(screen.getByRole("alert").textContent).toContain("verified campus channel");
  });

  it("routes pending accounts to password setup and allows account sign-out", async () => {
    const { onSignOut } = gateway({ ...anonymous, authenticated: true, account: { userId: "0333fc74-9a72-453c-ac9b-5bb60f142684", status: "pending", assignments: [] } });
    expect(screen.getByRole("heading", { name: "One more step to get started." })).toBeDefined();
    expect(screen.getByRole("link", { name: "Continue account setup" }).getAttribute("href")).toBe("/auth/password");
    expect(screen.queryByRole("form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out and use another account" }));
    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
  });

  it.each(["suspended", "deactivated"] as const)("clearly denies %s accounts without showing sign-in or campus data", (status) => {
    gateway({ ...anonymous, authenticated: true, account: { userId: "0333fc74-9a72-453c-ac9b-5bb60f142684", status, assignments: [] } });
    expect(screen.getByRole("heading", { name: "Campus access is denied." })).toBeDefined();
    expect(screen.getByText(/Signing in again cannot change/)).toBeDefined();
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  });
});
