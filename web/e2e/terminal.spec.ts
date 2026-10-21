/* The Terminal view, with the stand-in program from playwright.config.ts instead of the TUI. The
   helper allows two sessions at once (MAX_SESSIONS), so this runs in the serial-terminal project,
   never beside another test that opens one. */
import { expect, test } from "./fixtures";

import { signIn } from "./support";

const view = (name: string) => `nav[aria-label="Views"] button[aria-label^="${name}"]`;

test("the terminal view runs a session and keeps it while you browse", async ({ page }) => {
  await signIn(page);
  await page.click(view("Terminal"));
  await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".xterm-rows")).toContainText("READY");
  await page.locator(".xterm").click();
  await page.keyboard.type("hello-reconix");
  await expect(page.locator(".xterm-rows")).toContainText("hello-reconix");
  await page.click(view("Overview"));
  await page.click(view("Terminal"));
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.locator(".xterm-rows")).toContainText("hello-reconix"); // the same session
});
