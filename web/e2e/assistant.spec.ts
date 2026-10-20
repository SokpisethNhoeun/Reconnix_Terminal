/* The AI Assistant: both entries open the same screen without a reload, the history entry, the
   shared draft and conversation, the stand-in model's streamed answer (e2e/llm-stub.mjs), the
   route's locks, the direct address and reduced motion. The chat panel breathes (it never holds
   still), so clicks inside it are forced. */
import { expect, type Page, test } from "@playwright/test";

import { sessionValue } from "../src/lib/auth/session";
import { TOKEN } from "../playwright.config";
import { sample, signIn } from "./support";

const tab = (page: Page) => page.locator('nav[aria-label="Views"] button[aria-label="AI Assistant"]');
const composer = (page: Page) => page.getByRole("textbox", { name: /^Ask about/ }).last();
const minimize = (page: Page) => page.getByRole("button", { name: "Back to the dashboard" }).click({ force: true });
const assistantShown = (page: Page) => expect(page.getByRole("heading", { name: "AI Assistant", level: 1 })).toBeVisible();

test("the Ask bar and the sidebar open the same assistant in place, and Back returns", async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => ((window as unknown as { kept: number }).kept = 7)); // gone after a reload
  await page.locator(".dash-askbar").click({ position: { x: 240, y: 60 } });
  await expect(page).toHaveURL(/view=assistant/);
  await assistantShown(page);
  await expect(tab(page)).toHaveAttribute("data-active", "true");
  await composer(page).fill("a draft for later");

  await minimize(page);
  await expect(page).not.toHaveURL(/view=assistant/);
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await expect(page.locator(".dash-askbar input")).toHaveValue("a draft for later"); // one draft

  await tab(page).click();
  await assistantShown(page);
  await expect(composer(page)).toHaveValue("a draft for later");
  await page.goBack();
  await expect(page).not.toHaveURL(/view=assistant/);
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await page.goForward();
  await assistantShown(page);
  expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(7); // never reloaded
});

test("opening it again while it is open adds no history entry", async ({ page }) => {
  await signIn(page);
  const before = await page.evaluate(() => history.length);
  await tab(page).click();
  await assistantShown(page);
  await tab(page).click(); // already open: nothing is pushed
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a question gets a streamed answer about the saved runs, kept across views and reloads", async ({ page }) => {
    await signIn(page);
    await tab(page).click();
    await composer(page).fill("Which runs wait on me?");
    await composer(page).press("Enter");
    const log = page.getByRole("log", { name: "Conversation" });
    await expect(log).toContainText(`Stub answer: I saw ${sample().length} runs. You asked: Which runs wait on me?`);
    await expect(composer(page)).toHaveValue("");

    await page.locator('nav[aria-label="Views"] button[aria-label="Findings"]').click();
    await expect(page.getByRole("heading", { name: "Findings", level: 1 })).toBeVisible();
    await tab(page).click();
    await expect(log).toContainText("Stub answer");
    await page.reload();
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("You asked: Which runs wait on me?");
  });

  test("one open run is what the assistant asks about", async ({ page }) => {
    await signIn(page);
    const run = sample()[0];
    await page.goto(`/?uid=${run.uid}&view=assistant`);
    await expect(page.getByRole("heading", { name: "AI Assistant", level: 1 }).locator("..")).toContainText(run.label);
    await composer(page).fill("Summarize it");
    await composer(page).press("Enter");
    await expect(page.getByRole("log", { name: "Conversation" })).toContainText("I saw 1 runs");
  });

  test("the breathing loops stop, and the direct address opens the assistant", async ({ page }) => {
    await signIn(page);
    await page.goto("/assistant");
    await expect(page).toHaveURL(/\/\?view=assistant$/);
    await assistantShown(page);
    const animation = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
    expect(await animation(".dash-assistant-panel")).toBe("none");
    expect(await animation(".dash-ai-icon")).toBe("none");
    await minimize(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  });
});

test("a viewer sees the assistant but cannot ask the model", async ({ page, context }) => {
  await context.addCookies([{ name: "reconix_view", value: sessionValue("viewer", TOKEN), domain: "127.0.0.1", path: "/" }]);
  await page.goto("/?view=assistant");
  await assistantShown(page);
  await expect(page.getByText(/needs the operator role/)).toBeVisible();
  const res = await page.request.post("/api/assistant", {
    headers: { Origin: "http://127.0.0.1:3199" },
    data: { uid: null, messages: [{ role: "user", content: "hi" }] },
  });
  expect(res.status()).toBe(403);
});

test("the route wants a signed-in operator, the page's origin and a valid request", async ({ page, request }) => {
  const body = { uid: null, messages: [{ role: "user", content: "hi" }] };
  expect((await request.post("/api/assistant", { data: body })).status()).toBe(401); // no session
  await signIn(page);
  const post = (data: unknown, origin = "http://127.0.0.1:3199") => page.request.post("/api/assistant", { headers: { Origin: origin }, data });
  expect((await post(body, "http://evil.example")).status()).toBe(403);
  expect((await post({ ...body, messages: [] })).status()).toBe(400);
  expect((await post({ ...body, extra: "context of my own" })).status()).toBe(400);
  expect((await post({ uid: "20200101-000000-dead_NOPE-1", messages: body.messages })).status()).toBe(404);
  const ok = await post(body);
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toContain("Stub answer");
});
