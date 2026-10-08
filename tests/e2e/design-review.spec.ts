import { expect, test } from "@playwright/test";
import { signInFixture } from "./campus-fixture";

const destinations = ["today", "directory", "events", "academics", "resources", "transport", "helpdesk", "lost-found", "complaints", "services", "administration", "actions"];

for (const width of [360, 768, 1440]) {
  test(`redesigned module surfaces fit ${width}px with readable actions`, async ({ page, context }, testInfo) => {
    await signInFixture(context);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const destination of destinations) {
      await page.goto(`/#${destination}`);
      const main = page.locator("#main-content");
      await expect(main.locator("h1:visible")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${destination}-${width}.png`), fullPage: true, animations: "disabled" });
    }
    expect(errors).toEqual([]);
  });
}

test("all dashboard content stays available without scroll animation or observer support", async ({ page, context }) => {
  await signInFixture(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => Object.defineProperty(window, "IntersectionObserver", { value: undefined }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Campus Today." })).toBeVisible();
  const appearances = await page.locator(".today-screen .reveal").evaluateAll((elements) => elements.map((element) => ({
    opacity: getComputedStyle(element).opacity, animation: getComputedStyle(element).animationName,
  })));
  expect(appearances.length).toBeGreaterThan(0);
  expect(appearances.every((value) => value.opacity === "1" && value.animation === "none")).toBe(true);
});

for (const width of [360, 1440]) {
  test(`campus spaces drawer is scannable and navigable at ${width}px`, async ({ page, context }, testInfo) => {
    await signInFixture(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#today");
    const trigger = width < 901 ? page.getByRole("button", { name: "Campus", exact: true }) : page.locator(".sidebar-explore");
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "One campus. A place for everything." })).toBeVisible();
    await expect(dialog).toContainText("City University · Bangladesh");
    await expect(dialog.locator(".module-drawer-group")).toHaveCount(4);
    await expect(dialog.locator(".module-drawer-item")).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const columns = await dialog.locator(".module-drawer-group-list").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(width < 600 ? 1 : 2);
    await page.screenshot({ path: testInfo.outputPath(`campus-spaces-${width}.png`), fullPage: true, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
}

test("campus spaces drawer navigates without losing the active module", async ({ page, context }) => {
  await signInFixture(context);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#today");
  const trigger = page.locator(".sidebar-explore");
  await trigger.click();
  await page.locator(".module-drawer-item").filter({ hasText: "Transport" }).click();
  await expect(page).toHaveURL(/#transport$/);
  await expect(page.getByRole("heading", { name: "Transport" })).toBeVisible();
  await trigger.click();
  await expect(page.locator(".module-drawer-item.is-active")).toContainText("Transport");
});

test("CSV import retains invalid input, previews, confirms roster-only and reads report back", async ({ page }, testInfo) => {
  const userId = "00000000-0000-4000-8000-000000000001";
  const batchId = "00000000-0000-4000-8000-000000000701";
  const session = { authenticated: true, fullName: "Synthetic Enrollment Reviewer", assurance: "aal2",
    account: { userId, status: "active", assignments: [{ role: "enrollment_admin", scope: { kind: "institution", id: "00000000-0000-4000-8000-000000000201" } }] },
    readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" } };
  const report = { batchId, state: "staged", records: [{ rowNumber: 1, studentId: "DEMO-001", email: "demo@example.invalid", fullName: "Synthetic Student", department: "Synthetic CS", batch: "Demo 2026", result: "new", reason: null, rosterId: null, authStatus: "pending", emailStatus: "not_requested" }] };
  let confirmed = false;
  let previews = 0;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: session }));
  await page.route("**/api/enrollment/imports**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/preview")) { previews += 1; return route.fulfill({ json: report }); }
    if (path.endsWith("/confirm")) {
      expect(route.request().postDataJSON()).toEqual({ batchId, sendInvitations: false });
      confirmed = true;
      return route.fulfill({ json: { report: { ...report, state: "confirmed" }, emailRequested: false, processingComplete: true } });
    }
    if (path.endsWith(batchId)) return route.fulfill({ json: { ...report, state: confirmed ? "confirmed" : "staged" } });
    return route.fulfill({ json: [{ batchId, state: confirmed ? "confirmed" : "staged", createdAt: "2026-10-08T00:00:00Z" }] });
  });
  await page.goto("/auth/enrollment");
  const source = page.getByRole("textbox", { name: "Paste CSV source" });
  const invalid = "studentId,email,fullName,department,batch\nDEMO-001,invalid,Synthetic Student,Synthetic CS,Demo 2026";
  await source.fill(invalid);
  await page.getByRole("button", { name: "Review source" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Row 2, email");
  await expect(source).toHaveValue(invalid);
  expect(previews).toBe(0);
  await source.fill(invalid.replace(",invalid,", ",demo@example.invalid,"));
  await page.getByRole("button", { name: "Review source" }).click();
  await expect(page.getByRole("heading", { name: "Review before confirmation" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("enrollment-review.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Confirm approved roster" }).click();
  await expect(page.getByRole("status")).toContainText("roster was saved");
  await page.getByRole("button", { name: "Load recent imports" }).click();
  await page.getByRole("button", { name: /Dhaka.*confirmed/ }).click();
  await expect(page.getByRole("heading", { name: "Saved roster outcomes" })).toBeVisible();
  expect(previews).toBe(1);
  expect(confirmed).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
