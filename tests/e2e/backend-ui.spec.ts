import { expect, test } from "@playwright/test";
import { signInFixture } from "./campus-fixture";

const userId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000301";
const token = "00000000-0000-4000-8000-000000000401";
const session = {
  authenticated: true, account: { userId, status: "active", assignments: [] },
  fullName: "Synthetic Browser Test", assurance: "aal1",
  readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" },
};

// Browser mocks verify rendering/dispatch, not hosted authentication or database policies.
test("private QR renders locally and disappears after a session change", async ({ page, context }) => {
  await signInFixture(context);
  let signedOut = false;
  const event = {
    id: eventId, club_id: "00000000-0000-4000-8000-000000000101", title: "Synthetic live-UI test",
    description: "Synthetic content returned by the browser test, not a hosted campus record.", category: "Technology",
    venue: "Synthetic room", starts_at: "2099-10-07T08:00:00Z", ends_at: "2099-10-07T10:00:00Z",
    registration_deadline: "2099-10-07T07:00:00Z", capacity: 5, visibility: "campus", status: "published",
    created_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z",
  };
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: session }));
  await page.route("**/api/events**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/ticket")) {
      return route.fulfill({ json: { ticket: signedOut ? null : {
        id: "00000000-0000-4000-8000-000000000501", event_id: eventId, status: "registered",
        ticket_token: token, checked_in_at: null, queued_at: "2026-10-07T00:00:00Z",
        updated_at: "2026-10-07T00:00:00Z", waitlist_position: null,
      } } });
    }
    if (path.endsWith(eventId)) return route.fulfill({ json: { event, host: "Synthetic test club" } });
    return route.fulfill({ json: { events: [event], page: 1, hasMore: false } });
  });
  await page.goto("/#events");
  await page.getByRole("button", { name: "Details and your ticket" }).click();
  const dialog = page.getByRole("dialog", { name: "Synthetic live-UI test" });
  const canvas = dialog.getByRole("img", { name: "Private event ticket QR code" });
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element) => {
    const pixels = (element as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 256, 256).data;
    return Array.from(pixels).some((value, index) => index % 4 === 0 && value === 0);
  })).toBe(true);
  signedOut = true;
  await page.evaluate(() => window.dispatchEvent(new Event("campus-session-changed")));
  await expect(dialog.getByText(token, { exact: true })).not.toBeVisible();
  await expect(canvas).not.toBeVisible();
});

test("TOTP setup is an explicit action and can hide its temporary key", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: session }));
  await page.route("**/api/auth/mfa", (route) => route.fulfill({ json: {
    currentLevel: "aal1", freshMfa: false, canEnroll: true, hasOtherVerifiedFactors: false, factors: [],
  } }));
  let enrollmentCalls = 0;
  await page.route("**/api/auth/mfa/enroll", (route) => {
    enrollmentCalls += 1;
    expect(route.request().method()).toBe("POST");
    return route.fulfill({ json: { factorId: "00000000-0000-4000-8000-000000000601", secret: "JBSWY3DPEHPK3PXP", qrCode: null } });
  });
  await page.goto("/auth/security");
  await expect(page.getByRole("heading", { name: "Your authenticators" })).toBeVisible();
  expect(enrollmentCalls).toBe(0);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.getByRole("heading", { name: "Add CampusOS to your authenticator" })).toBeVisible();
  expect(enrollmentCalls).toBe(1);
  await page.getByText("Manual setup key", { exact: true }).click();
  await expect(page.locator(".mfa-secret")).toBeVisible();
  await page.getByRole("button", { name: "Hide setup details" }).click();
  await expect(page.locator(".mfa-secret")).not.toBeVisible();
});

test("opening an invitation review does not verify its token", async ({ page }) => {
  let verificationCalls = 0;
  await page.route("**/api/auth/confirm", (route) => {
    verificationCalls += 1;
    return route.fulfill({ status: 503, json: { error: { code: "configuration", message: "Synthetic unavailable response" } } });
  });
  await page.goto(`/auth/confirm?token_hash=${"a".repeat(64)}&type=invite`);
  await expect(page.getByRole("button", { name: "Confirm and continue" })).toBeVisible();
  expect(verificationCalls).toBe(0);
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.locator(".identity-panel").getByRole("alert")).toContainText("Synthetic unavailable response");
  expect(verificationCalls).toBe(1);
});
