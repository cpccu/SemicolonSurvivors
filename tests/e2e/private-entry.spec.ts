import { expect, test } from "@playwright/test";
import { signInFixture } from "./campus-fixture";

test("successful sign-in requests the server-authorized campus tree", async ({ page, context }) => {
  await page.route("**/api/auth/sign-in", async (route) => {
    await signInFixture(context);
    return route.fulfill({ json: {
      authenticated: true, account: { userId: "00000000-0000-4000-8000-000000000001", status: "active", assignments: [] },
      fullName: "Synthetic Browser Test", assurance: "aal1",
      readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" },
    } });
  });
  await page.goto("/");
  await page.getByLabel("Approved email address").fill("browser@example.invalid");
  await expect(page.getByText("City University · Bangladesh", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("synthetic fixture only");
  await page.getByRole("button", { name: "Sign in to CampusOS", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Campus Today." })).toBeVisible();
  await expect(page.locator(".campus-header").getByText("City University · Bangladesh", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('img[src*="city-university-mark.png"]').filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator(".today-page-heading").getByText("Synthetic Browser Test", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to your campus." })).not.toBeVisible();
});

test("anonymous visitors cannot see campus navigation or content in HTML or RSC", async ({ page, request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).not.toContain("New room. Same class");
  expect(html).not.toContain("Synthetic Browser Test");
  expect(html).not.toContain('class="campus-shell"');
  const rsc = await request.get("/", { headers: { RSC: "1" } });
  expect(await rsc.text()).not.toMatch(/today-screen|New time\.|Database Systems|campus-shell/);
  await page.goto("/#lost-found");
  await expect(page.getByRole("heading", { name: "Welcome to your campus." })).toBeVisible();
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await expect(page.getByText("Canvas backpack", { exact: true })).not.toBeVisible();
});

test("campus endpoints and sample downloads reject anonymous requests", async ({ request }) => {
  for (const endpoint of ["/api/events", "/api/academics", "/api/resources", "/api/helpdesk", "/api/services",
    "/api/directory", "/api/transport", "/api/lost-found", "/api/complaints", "/samples/sql-study-guide.txt", "/samples/sql-study-guide.pdf"]) {
    const response = await request.get(endpoint);
    expect(response.status(), endpoint).toBe(401);
    expect(response.headers()["cache-control"], endpoint).toContain("no-store");
  }
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await (await request.get("/api/auth/session")).json()).authenticated).toBe(false);
});

test("forged cookies and a mocked client session cannot unlock server campus content", async ({ page, context }) => {
  const forged = "base64-" + Buffer.from(JSON.stringify({ access_token: "forged.token.signature", refresh_token: "synthetic", user: {} })).toString("base64url");
  await context.addCookies([{ name: "sb-127-auth-token", value: forged, domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
    authenticated: true, account: { userId: "00000000-0000-4000-8000-000000000001", status: "active", assignments: [] },
    fullName: "Forged client claim", assurance: "aal1",
    readiness: { signInAvailable: true, emailAvailable: false, schema: "ready", email: "disabled" },
  } }));
  await page.goto("/");
  await expect(page.locator(".campus-shell")).not.toBeVisible();
  await expect(page.getByText("New time.", { exact: true })).not.toBeVisible();
});

for (const width of [360, 768, 1440]) {
  test(`private account gateway fits ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to your campus." })).toBeVisible();
    await expect(page.locator('img[alt="City University"]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`gateway-${width}.png`), fullPage: true });
  });
}
