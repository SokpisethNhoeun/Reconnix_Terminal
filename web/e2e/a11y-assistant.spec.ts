/* Accessibility of the AI Assistant's states that write a conversation (one sent, and the
   History list): they share the assistant's conversation folder with e2e/assistant.spec.ts, so
   they run in the serial-assistant project (playwright.config.ts), never beside another writer. */
import { expect, test } from "./fixtures";

import { axe, show } from "./axe";

test.describe("axe", () => {
  test.use({ reducedMotion: "reduce" }); // everything on screen at once, nothing mid-animation

  test("the assistant with a conversation has no violations", async ({ page }) => {
    await show(page, "/?view=assistant");
    const composer = page.getByRole("textbox", { name: /^Ask about/ }).last();
    await composer.fill("Which runs wait on me?");
    await expect(async () => {
      if (await composer.inputValue()) await composer.press("Enter");
      expect(await composer.inputValue()).toBe("");
    }).toPass({ timeout: 15_000 });
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("Which runs wait on me?");
    await expect(page.getByRole("log", { name: "Conversation" })).not.toHaveAttribute("aria-busy", "true");
    await axe(page, "assistant with a conversation");
  });

  test("the assistant's History has no violations", async ({ page }) => {
    await show(page, "/?view=assistant");
    await page.getByRole("button", { name: /^History/ }).click();
    await expect(page.getByRole("dialog", { name: "Conversation history" })).toBeVisible();
    await axe(page, "assistant history");
  });
});
