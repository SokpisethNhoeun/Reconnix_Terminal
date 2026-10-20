/* The AI Assistant: both entries open the same screen without a reload, the history entry and
   the shared draft; answers streamed by the stand-in model (e2e/llm-stub.mjs) with the cards the
   server built from the sample data; conversations the dashboard's server keeps (they survive
   a reload and a new browser; open, rename, delete); Markdown with Copy; Stop and "New
   messages"; Retry; what a viewer can't do; and the routes' locks. The chat panel breathes (it
   never holds still), so clicks inside it are forced outside the reduced-motion tests. The
   stand-in model changes its answer only for explicit [stub:…] tokens. Conversations go to a
   test folder, and the e2e server allows more questions a minute (playwright.config.ts). */
import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { sessionValue } from "../src/lib/auth/session";
import { PORT, TOKEN } from "../playwright.config";
import { counted, newest, sample, signIn } from "./support";

const ORIGIN = `http://127.0.0.1:${PORT}`;
const tab = (page: Page) => page.locator('nav[aria-label="Views"] button[aria-label="AI Assistant"]');
const composer = (page: Page) => page.getByRole("textbox", { name: /^Ask about/ }).last();
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });
const minimize = (page: Page) => page.getByRole("button", { name: "Back to the dashboard" }).click({ force: true });
const assistantShown = (page: Page) => expect(page.getByRole("heading", { name: "Reconix AI Assistant", level: 1 })).toBeVisible();
const history = (page: Page) => page.getByRole("dialog", { name: "Conversation history" });
const header = (page: Page) => page.locator("header", { hasText: "Reconix AI Assistant" });
const openHistory = async (page: Page) => {
  await page.getByRole("button", { name: /^History/ }).click({ force: true });
  await expect(history(page)).toBeVisible();
};
const ask = async (page: Page, question: string) => {
  await expect(log(page)).toHaveAttribute("aria-busy", "false"); // the last answer has ended
  await composer(page).fill(question);
  await composer(page).press("Enter");
};
/** Starts from no saved conversations (the folder outlives a run). */
const forgetAll = async (page: Page) => {
  const res = await page.request.delete("/api/assistant/conversations", { headers: { Origin: ORIGIN } });
  expect(res.status()).toBe(200);
};

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

  test("the welcome suggests from the real data, leaves a slot for the globe, and needs no motion", async ({ page }) => {
    await signIn(page);
    await page.goto("/assistant");
    await expect(page).toHaveURL(/\/\?view=assistant$/);
    await assistantShown(page);
    const all = sample();
    const suggestions = page.getByRole("list", { name: "Suggested questions" });
    await expect(suggestions.getByRole("button")).toHaveCount(6); // one run waits: the approvals suggestion is there
    await expect(suggestions).toContainText(`${all.reduce((n, a) => n + counted(a).length, 0)} findings`);
    await expect(suggestions).toContainText(`${all.filter((a) => a.status === "Completed").length} of ${all.length} runs completed`);
    await expect(page.locator("[data-globe-slot]")).toHaveCount(1);
    await expect(page.locator("[data-assistant-piece]")).toHaveCount(3);
    const animation = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);
    expect(await animation(".dash-assistant-panel")).toBe("none");
    expect(await animation(".dash-ai-icon")).toBe("none");
    await minimize(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  });

  test("a conversation is kept by the server: cards from the saved data, a reload, a new browser, rename and delete", async ({ page, browser }) => {
    await signIn(page);
    await forgetAll(page);
    await page.goto("/?view=assistant");
    // a suggestion asks, the findings card comes from the sample data, then the model's text
    await page.getByRole("button", { name: /Analyze current findings/ }).click();
    const findings = log(page).getByRole("region", { name: "Findings" });
    await expect(findings).toBeVisible();
    const total = sample().reduce((n, a) => n + counted(a).length, 0);
    await expect(findings).toContainText(`${total} across ${sample().length} runs`);
    await expect(findings).toContainText("Saved data");
    await expect(log(page)).toContainText(`Stub answer: I saw ${sample().length} runs. Earlier turns: 0. You asked: Analyze the current findings`);
    // a follow-up gets the first turn back from the server's file, not from the page
    await ask(page, "What waits on my approval?");
    await expect(log(page)).toContainText("Earlier turns: 2. You asked: What waits on my approval?");
    const approvals = log(page).getByRole("region", { name: "Approvals" });
    await expect(approvals).toContainText("1 waiting for you");
    await expect(approvals).toContainText("Waiting for approval");
    await expect(approvals).toContainText("Nothing can be approved from this chat.");
    await expect(approvals.getByRole("button", { name: /approve/i })).toHaveCount(0);

    // the tab keeps only which conversation is open and the draft, never the messages
    await composer(page).fill("not sent token=abc123secret");
    const stored = () => page.evaluate(() => ({ v1: sessionStorage.getItem("reconix.assistant.v1"), v2: sessionStorage.getItem("reconix.assistant.v2") ?? "" }));
    await expect.poll(async () => (await stored()).v2).toContain("not sent token=");
    const { v1, v2 } = await stored();
    expect(v1).toBeNull();
    const kept = JSON.parse(v2) as Record<string, unknown>;
    expect(Object.keys(kept).sort()).toEqual(["draft", "openId", "pageUid"]);
    expect(String(kept.draft)).not.toContain("abc123secret");
    expect(v2).not.toContain("Stub answer");

    await page.reload();
    await expect(log(page)).toContainText("You asked: What waits on my approval?");
    await expect(log(page).getByRole("region", { name: "Findings" })).toBeVisible(); // the cards were saved too

    // a new browser (nothing in its storage), signed in again, finds it in History
    const other: BrowserContext = await browser.newContext({ reducedMotion: "reduce" });
    const again = await other.newPage();
    await signIn(again);
    await again.goto("/?view=assistant");
    await expect(log(again)).not.toContainText("Stub answer");
    await openHistory(again);
    await history(again).getByRole("button", { name: /^Analyze the current findings/ }).click();
    await expect(log(again)).toContainText("You asked: What waits on my approval?");
    await expect(header(again)).toContainText("All assessments");

    // rename, then delete
    await openHistory(again);
    await history(again).getByRole("button", { name: "Rename “Analyze the current findings”" }).click();
    await history(again).getByRole("textbox", { name: "Conversation name" }).fill("Triage of every run");
    await history(again).getByRole("button", { name: "Save the name" }).click();
    await expect(history(again).getByRole("button", { name: /^Triage of every run/ })).toBeVisible();
    await again.keyboard.press("Escape");
    await expect(history(again)).toBeHidden();
    await openHistory(page);
    await expect(history(page).getByRole("button", { name: /^Triage of every run/ })).toBeVisible(); // the same server copy
    await page.keyboard.press("Escape");

    await openHistory(again);
    await history(again).getByRole("button", { name: "Delete “Triage of every run”" }).click();
    await history(again).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(history(again)).toContainText("No saved conversations yet");
    await expect(log(again)).not.toContainText("Stub answer"); // the open one was deleted: a new chat
    await other.close();
    expect((await page.request.get("/api/assistant/conversations")).ok()).toBe(true);
    expect((await (await page.request.get("/api/assistant/conversations")).json()).conversations).toEqual([]);
  });

  test("one open run is what a conversation is about, and stays about", async ({ page }) => {
    await signIn(page);
    const run = newest();
    await page.goto(`/?uid=${run.uid}&view=assistant`);
    await expect(header(page)).toContainText(run.label);
    await expect(header(page)).toContainText("Waiting for you"); // its status as a badge
    await page.getByRole("button", { name: /Review assessment progress/ }).click();
    await expect(log(page)).toContainText("I saw 1 runs");
    const progress = log(page).getByRole("region", { name: "Assessment progress" });
    await expect(progress.getByRole("listitem")).toHaveCount(5);
    await expect(progress).toContainText("Running");
    await expect(progress).toContainText("Planned");
    // the dashboard moves to every run: the next question starts a new conversation about it
    await page.goto("/?view=assistant");
    await expect(header(page)).toContainText("All assessments");
    await expect(log(page)).not.toContainText("Stub answer");
  });

  test("Markdown tables and code with Copy, a long answer, New messages and Stop", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
    await signIn(page);
    await page.goto("/?view=assistant");
    await ask(page, "Show the findings as a table [stub:markdown]");
    const table = log(page).getByRole("region", { name: "Table" });
    await expect(table.getByRole("columnheader", { name: "Severity" })).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(3);
    expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true); // it scrolls sideways
    const code = log(page).getByRole("figure").filter({ hasText: "bash" });
    await code.getByRole("button", { name: "Copy the bash code" }).click();
    await expect(code.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("curl -s 'https://staging.example.com/api/v1/orders");

    await ask(page, "Give me the whole story [stub:long]");
    await expect(log(page)).toContainText("Paragraph 6");
    const down = page.getByRole("button", { name: /new messages/i });
    await expect(down).toBeHidden(); // following the text at the bottom
    await log(page).evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(down).toBeVisible();
    await down.click();
    await expect(down).toBeHidden();
    await page.getByRole("button", { name: "Stop the answer" }).click();
    await expect(log(page).getByText("Stopped")).toBeVisible();
    await expect(log(page)).not.toContainText("The end of the long answer");
    // the server saves what had arrived, marked stopped
    const id = await page.evaluate(() => JSON.parse(sessionStorage.getItem("reconix.assistant.v2") ?? "{}").openId as string);
    const lastState = async () => {
      const { conversation } = await (await page.request.get(`/api/assistant/conversations/${id}`)).json();
      return conversation.messages.at(-1).state as string;
    };
    await expect.poll(lastState).toBe("stopped");
    await page.reload();
    await expect(log(page).getByText("Stopped")).toBeVisible();
    await expect(log(page)).toContainText("Paragraph 6");

    // Delete all asks first
    await openHistory(page);
    await history(page).getByRole("button", { name: "Delete all", exact: true }).click();
    await history(page).getByRole("button", { name: "Delete all conversations" }).click();
    await expect(history(page)).toContainText("No saved conversations yet");
    await expect(log(page)).not.toContainText("Paragraph 6");
  });

  test("approvals and planning stay in the TUI: guidance and Open Terminal, never a plan", async ({ page }) => {
    await signIn(page);
    await page.goto("/?view=assistant");
    await page.getByRole("button", { name: /Plan a security assessment/ }).click();
    const plan = log(page).getByRole("region", { name: "Plan a new assessment in the TUI" });
    await expect(plan).toContainText("no plan has been made");
    await expect(log(page)).toContainText("You asked: Plan a security assessment");
    await ask(page, "Explain the top finding");
    const top = log(page).getByRole("region", { name: /^Finding / });
    await expect(top).toContainText("CVSS");
    await top.getByRole("link", { name: /in Findings$/ }).click();
    await expect(page).toHaveURL(/view=findings/);
    await expect(page).toHaveURL(/finding=/);
    await expect(page.getByRole("heading", { name: "Findings", level: 1 })).toBeVisible();
    await tab(page).click();
    await plan.getByRole("button", { name: "Open Terminal" }).click();
    await expect(page).toHaveURL(/view=terminal/);
  });
});

test("a viewer sees the assistant but can't ask or read conversations", async ({ page, context }) => {
  await context.addCookies([{ name: "reconix_view", value: sessionValue("viewer", TOKEN), domain: "127.0.0.1", path: "/" }]);
  await page.goto("/?view=assistant");
  await assistantShown(page);
  await expect(page.getByText(/needs the operator role/).first()).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: /^History/ })).toBeDisabled();
  await expect(page.getByRole("list", { name: "Suggested questions" }).getByRole("button").first()).toBeDisabled();
  const post = await page.request.post("/api/assistant", { headers: { Origin: ORIGIN }, data: { uid: null, question: "hi" } });
  expect(post.status()).toBe(403);
  expect((await page.request.get("/api/assistant/conversations")).status()).toBe(403);
  expect((await page.request.get("/api/assistant/conversations/0b0e2d55-1c5a-4b1e-9b8c-2f1d3c4b5a69")).status()).toBe(403);
});

test("the routes want a signed-in operator, the page's origin and a valid request", async ({ page, request }) => {
  const body = { uid: null, question: "hi" };
  expect((await request.post("/api/assistant", { data: body })).status()).toBe(401); // no session
  expect((await request.get("/api/assistant/conversations")).status()).toBe(401);
  await signIn(page);
  const post = (data: unknown, origin = ORIGIN) => page.request.post("/api/assistant", { headers: { Origin: origin }, data });
  expect((await post(body, "http://evil.example")).status()).toBe(403);
  expect((await post({ uid: null, messages: [{ role: "user", content: "hi" }] })).status()).toBe(400); // no history from the browser
  expect((await post({ uid: "20200101-000000-dead_NOPE-1", question: "hi" })).status()).toBe(404);
  const ok = await post(body);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("application/x-ndjson");
  const lines = (await ok.text()).trim().split("\n").map((l) => JSON.parse(l) as { t: string; delta?: string; conversationId?: string });
  expect(lines[0].t).toBe("meta");
  expect(lines.at(-1)?.t).toBe("done");
  expect(lines.map((l) => l.delta ?? "").join("")).toContain("Stub answer");

  const id = lines[0].conversationId!;
  expect((await page.request.get(`/api/assistant/conversations/${id}`)).status()).toBe(200);
  expect((await page.request.get("/api/assistant/conversations/not-an-id")).status()).toBe(400);
  expect((await page.request.patch(`/api/assistant/conversations/${id}`, { headers: { Origin: "http://evil.example" }, data: { title: "x" } })).status()).toBe(403);
  expect((await page.request.delete(`/api/assistant/conversations/${id}`, { headers: { Origin: "http://evil.example" } })).status()).toBe(403);
  expect((await page.request.delete(`/api/assistant/conversations/${id}`, { headers: { Origin: ORIGIN } })).status()).toBe(200);
});
