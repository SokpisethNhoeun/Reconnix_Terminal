/* Accessibility of the AI Assistant's states that write a conversation (one sent, and the
   History list) or read the saved models (each step of the composer's model picker, and the
   picker as a phone's sheet): they share the assistant's folder with e2e/assistant.spec.ts, so
   they run in the serial-assistant project (playwright.config.ts), never beside another
   writer. */
import { expect, test } from "./fixtures";

import { LLM_PORT } from "../playwright.config";
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

  test("each step of the model picker has no violations", async ({ page }) => {
    await show(page, "/?view=assistant");
    await page.locator(".ai-composer").getByRole("button", { name: /^Model: / }).click();
    // step 1: your models, the providers (the cloud ones disabled with the reason)
    const pick = page.getByRole("dialog", { name: "Choose a model", exact: true });
    await expect(pick.getByRole("menuitemradio").first()).toBeFocused();
    await axe(page, "assistant model picker: choose a model");
    // step 2: credentials, then with a refusal shown
    await pick.getByRole("button", { name: /^Custom/ }).click();
    const creds = page.getByRole("dialog", { name: "Custom · credentials", exact: true });
    await expect(creds.getByLabel("Base URL", { exact: true })).toBeFocused();
    await axe(page, "assistant model picker: credentials");
    await creds.getByLabel("Base URL", { exact: true }).fill("ftp://127.0.0.1/v1");
    await creds.getByRole("button", { name: "Continue" }).click();
    await expect(creds.getByRole("alert")).toBeVisible();
    await axe(page, "assistant model picker: a refusal");
    // step 3: the stand-in's models (nothing is saved: the picker is left before Use)
    await creds.getByLabel("Base URL", { exact: true }).fill(`http://127.0.0.1:${LLM_PORT}/v1`);
    await creds.getByRole("button", { name: "Continue" }).click();
    const choose = page.getByRole("dialog", { name: "Custom · choose a model", exact: true });
    await expect(choose.getByRole("radio").first()).toBeFocused();
    await choose.getByRole("radio", { name: "Type a model name" }).check();
    await expect(choose.getByLabel("Model name", { exact: true })).toBeVisible();
    await axe(page, "assistant model picker: choose a model of the provider");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(pick).toBeHidden();
  });

  test("the model picker as a sheet on a phone has no violations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await show(page, "/?view=assistant");
    const chip = page.locator(".ai-composer").getByRole("button", { name: /^Model: / });
    await chip.click();
    const pick = page.getByRole("dialog", { name: "Choose a model", exact: true });
    await expect(pick.getByRole("menuitemradio").first()).toBeFocused();
    // the sheet spans the composer, above it, inside the window
    const [sheet, box] = await Promise.all([pick.boundingBox(), page.locator(".ai-composer").boundingBox()]);
    expect(Math.abs(sheet!.x - box!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(sheet!.width - box!.width)).toBeLessThanOrEqual(1);
    expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(box!.y);
    expect(sheet!.y).toBeGreaterThanOrEqual(0);
    await axe(page, "assistant model picker on a phone");
  });
});
