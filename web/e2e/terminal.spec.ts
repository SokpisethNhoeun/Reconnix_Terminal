/* The Terminal page: an operator gets a live session on the terminal helper (here a
   stand-in that prints READY and echoes what is typed), kept while browsing, and its
   controls (restart, expand, copy, clear, latest). */
import { type Page, expect, test } from "@playwright/test";

import { PORT, TERM_PORT } from "../playwright.config";
import { signIn } from "./support";

const screen = (page: Page) => page.locator(".xterm-rows");
const status = (page: Page, text: string) => page.locator(".pill", { hasText: text });

async function openTerminal(page: Page) {
  await page.getByRole("link", { name: "Terminal" }).click();
  await expect(page).toHaveURL(/\/terminal$/);
  await expect(status(page, "Connected")).toBeVisible();
  await expect(screen(page)).toContainText("READY");
}

async function type(page: Page, text: string) {
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("an operator opens the terminal and types in it", async ({ page }) => {
  await expect(page.locator(".pill", { hasText: "operator" })).toBeVisible();
  await openTerminal(page);
  await type(page, "hello from the web");
  await expect(screen(page)).toContainText("hello from the web");
});

test("the session keeps running while you look at the other pages", async ({ page }) => {
  await openTerminal(page);
  await type(page, "still the same session");
  await page.getByRole("link", { name: "Findings" }).click();
  await expect(page.getByRole("heading", { name: "Findings", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Reconix terminal")).toBeHidden();
  await page.getByRole("link", { name: "Terminal" }).click();
  await expect(screen(page)).toContainText("still the same session");
  await expect(status(page, "Connected")).toBeVisible();
});

test("Restart asks first, then starts over", async ({ page }) => {
  await openTerminal(page);
  await type(page, "before the restart");
  await page.getByRole("button", { name: "Restart session" }).click();
  await page.getByRole("menuitem", { name: "Keep this session" }).click();
  await expect(screen(page)).toContainText("before the restart");

  await page.getByRole("button", { name: "Restart session" }).click();
  await page.getByRole("menuitem", { name: "Restart" }).click();
  await expect(status(page, "Connected")).toBeVisible();
  await expect(screen(page)).toContainText("READY");
  await expect(screen(page)).not.toContainText("before the restart");
});

test("Expand fills the window and Restore brings the page back", async ({ page }) => {
  await openTerminal(page);
  const term = page.locator(".term");
  const before = (await term.boundingBox())!;
  await page.getByRole("button", { name: "Expand" }).click();
  await expect(page.locator(".term-full")).toBeVisible();
  await expect.poll(async () => (await term.boundingBox())!.width).toBeGreaterThan(1380);
  // the keyboard stays with the terminal
  await type(page, "typed while expanded");
  await expect(screen(page)).toContainText("typed while expanded");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.locator(".term-full")).toHaveCount(0);
  await expect.poll(async () => Math.round((await term.boundingBox())!.width)).toBe(Math.round(before.width));
});

test("Copy output puts the terminal's text on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openTerminal(page);
  await type(page, "copy me please");
  await expect(screen(page)).toContainText("copy me please");
  await page.getByRole("button", { name: "Copy output" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("READY");
  expect(text).toContain("copy me please");
  expect(text).toBe(text.trimEnd());
});

test("Clear wipes the screen and the session goes on", async ({ page }) => {
  await openTerminal(page);
  await type(page, "before the clear");
  await page.getByRole("button", { name: "Clear terminal" }).click();
  await expect(screen(page)).not.toContainText("READY");
  await expect(screen(page)).not.toContainText("before the clear");
  await expect(status(page, "Connected")).toBeVisible();
  await type(page, "after the clear");
  await expect(screen(page)).toContainText("after the clear");
});

test("Latest shows while scrolled up and jumps back down", async ({ page }) => {
  await openTerminal(page);
  for (let i = 1; i <= 40; i++) await type(page, `line ${i}`);
  await expect(screen(page)).toContainText("line 40");
  const latest = page.getByRole("button", { name: "Scroll to the latest output" });
  await expect(latest).toHaveCount(0);
  await page.locator(".term").hover();
  await page.mouse.wheel(0, -2000);
  await expect(latest).toBeVisible();
  await latest.click();
  await expect(latest).toHaveCount(0);
  await expect(screen(page)).toContainText("line 40");
});

test("tickets are handed out to the dashboard's own pages only", async ({ page }) => {
  const foreign = await page.request.post("/api/terminal/ticket", { headers: { Origin: "http://evil.example.com" } });
  expect(foreign.status()).toBe(403);

  const own = await page.request.post("/api/terminal/ticket", { headers: { Origin: `http://127.0.0.1:${PORT}` } });
  expect(own.status()).toBe(200);
  expect(own.headers()["cache-control"]).toContain("no-store");
  const body = await own.json();
  expect(body.url).toBe(`ws://127.0.0.1:${TERM_PORT}/`);
  expect(body.ticket).toMatch(/^\d+\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
});

test("pages may connect to the terminal helper and nothing else", async ({ page }) => {
  const res = await page.goto("/");
  expect(res!.headers()["content-security-policy"]).toContain(`connect-src 'self' ws://127.0.0.1:${TERM_PORT}`);
});
