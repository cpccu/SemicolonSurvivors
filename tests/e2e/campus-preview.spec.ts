import { expect, test } from "@playwright/test";
import { signInFixture } from "./campus-fixture";

test.beforeEach(async ({ page, context }) => {
  await signInFixture(context);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Campus Today." })).toBeVisible();
});

test("dashboard is labeled and does not overflow the viewport", async ({ page }, testInfo) => {
  await expect(page.getByText("Campus workspace · connected data and actions", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with a task" })).toBeVisible();
  await expect(page.locator(".today-screen .preview-disclosure")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("today.png"), fullPage: true });
});

test("search filters module results and opens the selected workspace", async ({ page }) => {
  await page.getByRole("button", { name: "Search campus (Control or Command K)" }).click();
  const search = page.getByRole("dialog", { name: "Find your way around campus" });
  const input = search.getByRole("textbox", { name: "Search campus" });
  await expect(input).toBeFocused();
  await input.fill("no-such-campus-record");
  await expect(search.getByRole("heading", { name: "No matches yet." })).toBeVisible();
  await input.fill("Resource Hub");
  await search.getByRole("button", { name: /Resource Hub/ }).click();
  await expect(page.getByRole("heading", { name: "Resource Hub." })).toBeVisible();
  await expect(search).not.toBeVisible();
});

test("event action does not fabricate a registration", async ({ page }) => {
  await page.goto("/#events");
  await expect(page.getByRole("heading", { name: "Live events" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Live events" }).getByText("No published events match this view.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Organizer workspace" })).toBeVisible();
  await expect(page.getByText("Synthetic event")).toHaveCount(0);
});

test("sign-out removes the campus and returns to private account access", async ({ page, context }) => {
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("campus-session-changed")));
  await expect(page.locator(".campus-shell")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to your campus." })).toBeVisible();
});

test("native modal traps focus and restores its opener", async ({ page }) => {
  const opener = page.getByRole("button", { name: "Search campus (Control or Command K)" });
  await opener.click();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});

test("motion preference does not hide content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("heading", { name: "Your learning toolkit." }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Your learning toolkit." })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".reveal")!).animationName)).toBe("none");
});

test("download contains a PDF course material for active accounts", async ({ page }) => {
  const response = await page.request.get("/samples/sql-study-guide.pdf");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).toString("latin1")).toContain("%PDF-1.4");
  expect((await response.body()).toString("latin1")).toContain("SQL joins");
});

test("health response and security headers do not expose secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
  expect(await response.text()).not.toMatch(/service_role|sb_secret_|AIza/);
});

test("all module destinations render without browser errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const destinations = [
    ["directory", "Campus directory."], ["events", "Clubs & events."],
    ["academics", "Academic updates."], ["resources", "Resource Hub."],
     ["transport", "Transport."], ["helpdesk", "Campus Decision Desk."],
    ["lost-found", "Lost & found."], ["complaints", "Your support requests"],
    ["services", "Forms & services."], ["administration", "Staff workspace."],
  ] as const;
  for (const [destination, heading] of destinations) {
    await page.goto(`/#${destination}`);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(browserErrors).toEqual([]);
});

test("AI Helpdesk is visible and links to the grounded question form", async ({ page }) => {
  await page.goto("/#helpdesk");
  await expect(page.getByRole("heading", { name: "Campus Decision Desk." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the Decision Desk/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Answer. Evidence. Next step." })).toBeVisible();
  await expect(page.getByText("Grounded by evidence", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Open the Decision Desk/ }).click();
  await expect(page.locator("#campus-ai")).toBeInViewport();
});

test("failed support submission retains the signed-in request input", async ({ page }) => {
  await page.route("**/api/complaints/offices", (route) => route.fulfill({ json: { offices: [{
    id: "00000000-0000-4000-8000-000000000701", title: "Synthetic fixture office", description: "Browser test office",
    default_staff_id: null, active: true,
  }] } }));
  await page.route("**/api/complaints", (route) => route.fulfill({ status: 503, json: { error: { code: "configuration", message: "Synthetic unavailable response; no request stored." } } }));
  await page.goto("/#complaints");
  // Hash navigation retains module state; reload after installing the office fixture.
  await page.reload();
  await page.getByRole("button", { name: "New private request" }).click();
  const draft = page.getByRole("dialog", { name: "Submit a private support request" });
  await draft.getByRole("combobox", { name: "Responsible office" }).selectOption("00000000-0000-4000-8000-000000000701");
  await draft.getByRole("textbox", { name: "Subject", exact: true }).fill("Fictional room light");
  await draft.getByRole("textbox", { name: "Private description" }).fill("This is a fictional test description, not a real complaint.");
  await draft.getByRole("button", { name: "Submit private request" }).click();
  await expect(draft.getByRole("alert")).toContainText("no request stored");
  await expect(draft.getByRole("textbox", { name: "Subject", exact: true })).toHaveValue("Fictional room light");
});

test("scroll reveals appear without locking native scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const section = page.locator(".resources-section");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveClass(/is-revealed/);
  await expect(section).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

for (const width of [360, 611, 768, 1440]) {
  test(`layout fits a ${width}px viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { name: "My Campus Today." })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`today-${width}.png`), fullPage: true });
  });
}
