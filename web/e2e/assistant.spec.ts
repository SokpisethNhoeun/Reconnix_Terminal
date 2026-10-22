/* The AI Assistant: both entries open the same screen without a reload, the history entry and
   the shared draft; answers streamed by the stand-in model (e2e/llm-stub.mjs) with the cards the
   server built from the sample data; conversations the dashboard's server keeps (they survive
   a reload and a new browser; open, rename, delete); Markdown with Copy; Stop and "New
   messages"; Retry; an answer with nothing in it; the Model menu (the Environment's model, + Add
   model against the stand-in, switching, asking with the new model, editing, removing); what a
   viewer can't do; and the routes' locks.
   The chat panel holds still (text never moves), but the welcome's globe and the sidebar's icon
   breathe, so this project runs with reduced motion (playwright.config.ts; the motion itself is
   tested in motion.spec.ts) and clicks need no `force`. The
   stand-in model changes its answer only for explicit [stub:…] tokens. Conversations go to a
   test folder, and the e2e server allows more questions a minute (playwright.config.ts). */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { type BrowserContext, type Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import { sessionValue } from "../src/lib/auth/session";
import { LLM_PORT, PORT, TOKEN } from "../playwright.config";
import { counted, newest, runsWithFindings, sample, signIn, signInFresh } from "./support";

const ORIGIN = `http://127.0.0.1:${PORT}`;
const tab = (page: Page) => page.locator('nav[aria-label="Views"] button[aria-label="AI Assistant"]');
const composer = (page: Page) => page.getByRole("textbox", { name: /^Ask about/ }).last();
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });
const minimize = (page: Page) => page.getByRole("button", { name: "Back to the dashboard" }).click();
const assistantShown = (page: Page) => expect(page.getByRole("heading", { name: "Reconix AI Assistant", level: 1 })).toBeVisible();
const history = (page: Page) => page.getByRole("dialog", { name: "Conversation history" });
const header = (page: Page) => page.locator("header", { hasText: "Reconix AI Assistant" });
const openHistory = async (page: Page) => {
  await page.getByRole("button", { name: /^History/ }).click();
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
/** Starts from no saved models (the e2e server's assistant folder, playwright.config.ts): the
    Environment's stub-model answers. Deleting the conversations never touches these files. */
const forgetModels = () => {
  const dir = path.join(tmpdir(), `reconix-e2e-assistant-${PORT}`);
  for (const name of ["models.json", "models.key"]) rmSync(path.join(dir, name), { force: true });
};
const modelButton = (page: Page) => page.getByRole("button", { name: /^Model:/ });
const modelMenu = (page: Page) => page.getByRole("dialog", { name: "Models" });

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
    await expect(findings).toContainText(`${total} across ${runsWithFindings().length} runs`);
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
    const other: BrowserContext = await browser.newContext({ reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
    const again = await other.newPage();
    await signInFresh(again);
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
    // a card link to another run opens it, and the conversation stays (it says it is about
    // every run while the dashboard shows that one)
    await ask(page, "Generate a report");
    const report = log(page).getByRole("region", { name: "Report" });
    await report.getByRole("button", { name: /RCX-DEMO-002/ }).first().click();
    await report.getByRole("link", { name: /^Open the Reports view of RCX-DEMO-002/ }).click();
    await expect(page).toHaveURL(/uid=\d{8}-\d{6}-[0-9a-f]{4}_RCX-DEMO-002/);
    await expect(page).toHaveURL(/view=reports/);
    await tab(page).click();
    await expect(log(page)).toContainText("You asked: Generate a report");
    await expect(log(page)).toContainText("You asked: Plan a security assessment");
    await expect(page.getByText(/This conversation is about All assessments/)).toBeVisible();
    await plan.getByRole("button", { name: "Open Terminal" }).click();
    await expect(page).toHaveURL(/view=terminal/);
  });
});

test.describe("when the model fails", () => {
  test.use({ reducedMotion: "reduce" });

  test("an answer with nothing in it is said plainly, with Retry, and stays so after a reload", async ({ page }) => {
    await page.goto("/?view=assistant");
    await ask(page, "Say nothing at all [stub:empty]");
    const empty = log(page).getByRole("region", { name: "The model returned nothing" });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Try asking again");
    await expect(log(page).getByRole("region", { name: "The assistant couldn't answer" })).toHaveCount(0);
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await empty.getByRole("button", { name: "Retry" }).click(); // the stub answers nothing again
    await expect(log(page).getByRole("region", { name: "The model returned nothing" })).toBeVisible();
    await expect(log(page).locator(".ai-bubble")).toHaveCount(1); // replaced, not kept twice
    await page.reload();
    await expect(log(page).getByRole("region", { name: "The model returned nothing" })).toBeVisible();
    await expect(log(page).getByRole("button", { name: "Retry" })).toBeVisible();
    // a question with cards gets them; the empty text under them is "no explanation", with Retry
    await ask(page, "Analyze the findings [stub:empty]");
    await expect(log(page).getByRole("region", { name: "Findings" })).toBeVisible();
    const none = log(page).getByRole("region", { name: "The model added no explanation" });
    await expect(none).toBeVisible();
    await expect(none.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(log(page).getByRole("region", { name: "The assistant couldn't answer" })).toHaveCount(0);
  });

  test("the reply says why, keeps its cards, and Retry replaces the failed turn", async ({ page }) => {
    await page.goto("/?view=assistant");
    await ask(page, "Summarize the findings [stub:fail]");
    const failed = log(page).getByRole("region", { name: "The assistant couldn't answer" });
    await expect(failed).toContainText("HTTP 500");
    await expect(log(page).getByRole("region", { name: "Findings" })).toBeVisible(); // the cards still came
    await failed.getByRole("button", { name: "Retry" }).click();
    await expect(log(page)).toContainText("Earlier turns: 0. You asked: Summarize the findings [stub:fail]");
    await expect(failed).toHaveCount(0);
    await page.reload();
    await expect(log(page)).toContainText("You asked: Summarize the findings [stub:fail]");
    await expect(log(page).locator(".ai-bubble")).toHaveCount(1); // replaced, not kept twice
    await expect(log(page).getByRole("region", { name: "The assistant couldn't answer" })).toHaveCount(0);
  });
});

test.describe("the Model menu", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(forgetModels);
  test.afterEach(forgetModels); // the other specs ask the Environment's stub-model

  test("lists the Environment, adds a model, switches in one click, asks with it, edits and removes it", async ({ page }) => {
    await page.goto("/?view=assistant");
    await expect(modelButton(page)).toHaveAccessibleName("Model: stub-model · local");
    await modelButton(page).click();
    const menu = modelMenu(page);
    await expect(menu).toBeVisible();
    const env = menu.getByRole("radiogroup", { name: /^Environment/ });
    await expect(env.getByRole("radio", { name: "stub-model" })).toHaveAttribute("aria-checked", "true");
    await expect(menu).toContainText("read-only");
    await expect(menu.getByRole("button", { name: /^Edit Environment/ })).toHaveCount(0);

    // + Add model: Custom, pointing at the stand-in; Fetch models picks from its list
    await menu.getByRole("button", { name: "Add model" }).click();
    const form = menu.getByRole("form", { name: "Add a model" });
    await expect(form.getByLabel("Provider", { exact: true })).toBeFocused();
    await form.getByLabel("Provider", { exact: true }).selectOption("custom");
    await form.getByLabel("Name", { exact: true }).fill("Stand-in");
    await form.getByLabel("Base URL", { exact: true }).fill(`http://127.0.0.1:${LLM_PORT}/v1`);
    await form.getByLabel("API key", { exact: true }).fill("stub-secret-key-0123");
    await form.getByRole("button", { name: "Fetch models" }).click();
    await expect(form).toContainText("The server lists 2 models");
    await form.getByRole("checkbox", { name: "stub-model", exact: true }).check();
    await form.getByRole("checkbox", { name: "stub-model-2", exact: true }).check();
    await expect(form.getByRole("list", { name: "Models of this provider" }).getByRole("listitem")).toHaveCount(2);
    await form.getByRole("checkbox", { name: "Use it for the next question" }).uncheck();
    await form.getByRole("button", { name: "Test connection" }).click();
    await expect(form.getByRole("status")).toHaveText("Connected: stub-model answered.");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form).toBeHidden();
    const saved = menu.getByRole("radiogroup", { name: "Stand-in" });
    await expect(saved.getByRole("radio")).toHaveCount(2);
    await expect(menu).toContainText("key saved");
    await expect(env.getByRole("radio")).toHaveAttribute("aria-checked", "true"); // not switched yet

    // one click switches; the header follows without a reload
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 3));
    await saved.getByRole("radio", { name: "stub-model-2" }).click();
    await expect(saved.getByRole("radio", { name: "stub-model-2" })).toHaveAttribute("aria-checked", "true");
    await expect(env.getByRole("radio")).toHaveAttribute("aria-checked", "false");
    await expect(modelButton(page)).toHaveAccessibleName("Model: stub-model-2 · local");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(modelButton(page)).toBeFocused();

    // the next question goes to it (the stand-in names any model but stub-model)
    await ask(page, "Which model answers?");
    await expect(log(page)).toContainText("You asked: Which model answers? Model: stub-model-2.");
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(3); // never reloaded
    const listed = await page.request.get("/api/assistant/models");
    expect(listed.status()).toBe(200);
    expect(await listed.text()).not.toContain("stub-secret-key-0123"); // the key never comes back

    // a reload keeps the choice (the server's file)
    await page.reload();
    await expect(modelButton(page)).toHaveAccessibleName("Model: stub-model-2 · local");

    // edit: Escape leaves the form first; the key field is never filled in
    await modelButton(page).click();
    await menu.getByRole("button", { name: "Edit Stand-in" }).click();
    const edit = menu.getByRole("form", { name: "Edit Stand-in" });
    await expect(edit.getByLabel("API key", { exact: true })).toHaveValue("");
    await expect(edit).toContainText("A key is saved");
    await edit.getByLabel("Name", { exact: true }).press("Escape");
    await expect(edit).toBeHidden();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Edit Stand-in" }).click();
    await edit.getByLabel("Name", { exact: true }).fill("Stub server");
    await edit.getByRole("button", { name: "Remove stub-model-2 from the list" }).click();
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();
    const renamed = menu.getByRole("radiogroup", { name: "Stub server" });
    await expect(renamed.getByRole("radio")).toHaveCount(1);
    await expect(renamed.getByRole("radio", { name: "stub-model" })).toHaveAttribute("aria-checked", "true"); // the active one left: its first model
    await expect(modelButton(page)).toHaveAccessibleName("Model: stub-model · local");

    // remove, asked first: the Environment answers again
    await menu.getByRole("button", { name: "Remove Stub server" }).click();
    await menu.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(renamed).toHaveCount(0);
    await expect(env.getByRole("radio")).toHaveAttribute("aria-checked", "true");
  });

  test("what the server refuses stays in the form, said under it", async ({ page }) => {
    await page.goto("/?view=assistant");
    await modelButton(page).click();
    await modelMenu(page).getByRole("button", { name: "Add model" }).click();
    const form = modelMenu(page).getByRole("form", { name: "Add a model" });
    await form.getByLabel("Provider", { exact: true }).selectOption("openai");
    await expect(form.getByLabel("Base URL", { exact: true })).toHaveValue("https://api.openai.com/v1");
    await expect(form).toContainText("LLM_ALLOW_REMOTE=1"); // the hint, before anything is sent
    await form.getByLabel("A model name to add").fill("gpt-4o-mini");
    await form.getByLabel("A model name to add").press("Enter");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("alert")).toContainText("not on this machine");
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(modelMenu(page).getByRole("radiogroup")).toHaveCount(1); // only the Environment
  });
});

test("a viewer sees the assistant but can't ask or read conversations", async ({ page, context }) => {
  await context.addCookies([{ name: "reconix_view", value: sessionValue("viewer", TOKEN), domain: "127.0.0.1", path: "/" }]);
  await page.goto("/?view=assistant");
  await assistantShown(page);
  await expect(page.getByText(/needs the operator role/).first()).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: /^History/ })).toBeDisabled();
  await expect(modelButton(page)).toBeDisabled();
  await expect(page.getByRole("list", { name: "Suggested questions" }).getByRole("button").first()).toBeDisabled();
  const post = await page.request.post("/api/assistant", { headers: { Origin: ORIGIN }, data: { uid: null, question: "hi" } });
  expect(post.status()).toBe(403);
  expect((await page.request.get("/api/assistant/conversations")).status()).toBe(403);
  expect((await page.request.get("/api/assistant/models")).status()).toBe(403);
  expect((await page.request.put("/api/assistant/models/active", { headers: { Origin: ORIGIN }, data: { providerId: "environment", model: "stub-model" } })).status()).toBe(403);
  expect((await page.request.get("/api/assistant/conversations/0b0e2d55-1c5a-4b1e-9b8c-2f1d3c4b5a69")).status()).toBe(403);
});

test("the routes want a signed-in operator, the page's origin and a valid request", async ({ page, playwright }) => {
  const body = { uid: null, question: "hi" };
  // no session: a context that starts with no cookies (the default one is signed in)
  const anonymous = await playwright.request.newContext({ baseURL: ORIGIN, storageState: { cookies: [], origins: [] } });
  expect((await anonymous.post("/api/assistant", { data: body })).status()).toBe(401);
  expect((await anonymous.get("/api/assistant/conversations")).status()).toBe(401);
  expect((await anonymous.get("/api/assistant/models")).status()).toBe(401);
  expect((await anonymous.post("/api/assistant/models/test", { data: { providerId: "environment" } })).status()).toBe(401);
  await anonymous.dispose();
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

  // the Model menu's routes: changes need the page's origin and a strict body
  const provider = { name: "x", preset: "custom", baseUrl: "http://127.0.0.1:1/v1", models: ["m"] };
  expect((await page.request.post("/api/assistant/models", { headers: { Origin: "http://evil.example" }, data: provider })).status()).toBe(403);
  expect((await page.request.put("/api/assistant/models/active", { headers: { Origin: "http://evil.example" }, data: { providerId: "environment", model: "stub-model" } })).status()).toBe(403);
  expect((await page.request.post("/api/assistant/models", { headers: { Origin: ORIGIN }, data: { ...provider, extra: 1 } })).status()).toBe(400);
  expect((await page.request.delete("/api/assistant/models/not-an-id", { headers: { Origin: ORIGIN } })).status()).toBe(400);
  const models = await page.request.get("/api/assistant/models");
  expect(models.status()).toBe(200);
  expect(models.headers()["cache-control"]).toContain("no-store");
});
