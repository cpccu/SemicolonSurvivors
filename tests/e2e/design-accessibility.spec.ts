import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { signInFixture } from "./campus-fixture";

const require = createRequire(import.meta.url);

test("account entry and signed-in overview have readable contrast and named controls", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const signedIn of [false, true]) {
    if (signedIn) await signInFixture(context);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: signedIn ? "My Campus Today." : "Welcome to your campus." })).toBeVisible();
    // axe-core is already pinned transitively by the existing lint toolchain.
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run(options: { runOnly: string[] }): Promise<{ violations: { id: string; nodes: { target: string[]; failureSummary: string }[] }[] }> } }).axe;
      const result = await axe.run({ runOnly: ["color-contrast", "button-name", "label", "aria-valid-attr-value"] });
      return result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
    });
    expect(violations).toEqual([]);
  }
});
