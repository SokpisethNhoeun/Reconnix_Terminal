/* The AI Assistant: both entries open the same screen without a reload, the history entry and
   the shared draft; the terminal's mark (◆) in the header and beside each answer, lit while one
   is written; answers streamed by the stand-in model (e2e/llm-stub.mjs) with the cards the
   server built from the sample data; conversations the dashboard's server keeps (they survive
   a reload and a new browser; open, rename, delete); Markdown with Copy; Stop and "New
   messages"; Retry; an answer with nothing in it; the composer and its model picker (the chip
   naming the Environment's model, no Model button in the header, Custom against the stand-in
   through credentials and the fetched list to asking with the new model, a one-click switch
   back, removing a provider, a cloud provider disabled with the reason, a refusal kept on its
   step, Escape a step back and then closed, the arrow keys, a typed API key never in the markup
   and gone with the picker when the Assistant is left by keyboard or by Back); what a viewer
   can't do; and the routes' locks.
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
/** The Reconix mark's colours as drawn (tile, diamond) and the tokens it should use, resolved the
    same way (ui/reconix-mark.tsx: --surface and --globe-glow, the TUI's cyan). */
const markColours = (svg: SVGElement | HTMLElement) => {
  const resolve = (token: string) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  };
  return {
    tile: getComputedStyle(svg.querySelector("rect")!).fill,
    diamond: getComputedStyle(svg.querySelector("path")!).fill,
    surface: resolve("--surface"),
    cyan: resolve("--globe-glow"),
  };
};
/** The composer's model chip: "Model: <name> (<provider>, local|remote)", or "Choose a model". */
const chip = (page: Page) => page.locator(".ai-composer").getByRole("button", { name: /^(Model: |Choose a model$)/ });
/** The model picker, named after its step ("Choose a model", "Custom · credentials"…). */
const picker = (page: Page, step: string) => page.getByRole("dialog", { name: step, exact: true });
/** An API key typed in the picker (the stand-in model takes none: it only has to be typed). */
const KEY = "sk-e2e-picker-key-0123456789abcdef";

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
    // the header's logo is the terminal's: the cyan ◆ on its dark tile, beside the name (so hidden)
    const logo = header(page).locator("[data-reconix-mark]");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("aria-hidden", "true");
    expect(await logo.boundingBox()).toMatchObject({ width: 26, height: 26 });
    const colours = await logo.evaluate(markColours);
    expect(colours.tile).toBe(colours.surface);
    expect(colours.diamond).toBe(colours.cyan);
    expect(colours.cyan).toBe("rgb(34, 211, 238)"); // #22D3EE, the TUI's CYAN
    await expect(logo).toHaveCSS("animation-name", "none");
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
    // each answer sits beside the mark (hidden: "Reconix AI:" names it), still once it is written
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    const avatars = log(page).locator(".ai-row-assistant > [data-reconix-mark]");
    await expect(avatars).toHaveCount(2);
    for (const avatar of await avatars.all()) {
      await expect(avatar).toHaveAttribute("aria-hidden", "true");
      expect(await avatar.boundingBox()).toMatchObject({ width: 26, height: 26 });
      const colours = await avatar.evaluate(markColours);
      expect([colours.tile, colours.diamond]).toEqual([colours.surface, colours.cyan]);
    }
    await expect(log(page).locator("[data-reconix-mark][data-live]")).toHaveCount(0);

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
    // the reply being written has a lit mark: with reduced motion a still glow, no loop
    const live = log(page).locator(".ai-row-assistant").last().locator("[data-reconix-mark][data-live]");
    await expect(live).toHaveCount(1);
    await expect(live).toHaveCSS("animation-name", "none");
    await expect(live).toHaveCSS("filter", /drop-shadow/);
    await page.getByRole("button", { name: "Stop the answer" }).click();
    await expect(log(page).getByText("Stopped")).toBeVisible();
    await expect(log(page).locator("[data-reconix-mark][data-live]")).toHaveCount(0); // stopped: still
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

test.describe("the composer and its model picker", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(forgetModels);
  test.afterEach(forgetModels); // the other specs ask the Environment's stub-model

  test("the composer: the chip names the Environment's model in green, the header has no Model button", async ({ page }) => {
    await page.goto("/?view=assistant");
    await assistantShown(page);
    await expect(header(page).getByRole("button", { name: /^Model/ })).toHaveCount(0);
    await expect(chip(page)).toHaveAccessibleName("Model: stub-model (Environment, local)");
    await expect(chip(page)).toHaveText("stub-model");
    await expect(chip(page)).toHaveAttribute("data-tone", "success");
    await expect(chip(page).locator(".ai-dot")).toHaveAttribute("data-tone", "success");
    await expect(chip(page)).toHaveAttribute("aria-expanded", "false");
    // the box: the text area on top, the chip bottom left, the hint and the send button on the right
    await expect(composer(page)).toHaveAttribute("placeholder", "Ask anything about your assessments…");
    const box = page.locator(".ai-composer");
    await expect(box.getByText("Enter to send · Shift+Enter for new line")).toBeVisible();
    await expect(box.getByRole("button", { name: "Send" })).toBeVisible();
    const [field, chipBox, send] = await Promise.all([composer(page).boundingBox(), chip(page).boundingBox(), box.getByRole("button", { name: "Send" }).boundingBox()]);
    expect(chipBox!.y).toBeGreaterThan(field!.y + field!.height - 2); // under the text area
    expect(send!.x).toBeGreaterThan(chipBox!.x + chipBox!.width); // to its right
    expect(Math.round(send!.width)).toBe(32);
    await expect(page.getByText("Answers use your saved assessment data. Scans and approvals stay in the terminal.")).toBeVisible();
  });

  test("Custom against the stand-in: credentials, the fetched list, Use this model, ask with it; one click back to the Environment; remove it", async ({ page }) => {
    await page.goto("/?view=assistant");
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 3));
    await chip(page).click();
    const pick = picker(page, "Choose a model");
    await expect(pick).toBeVisible();
    await expect(chip(page)).toHaveAttribute("aria-expanded", "true");
    const yours = pick.getByRole("menu", { name: "Your models" });
    await expect(yours.getByRole("menuitemradio")).toHaveCount(1);
    await expect(yours.getByRole("menuitemradio", { name: /^stub-model Environment/ })).toHaveAttribute("aria-checked", "true");
    await expect(yours.getByRole("menuitemradio", { name: /^stub-model Environment/ })).toBeFocused(); // the step's first control
    const providers = pick.getByRole("list", { name: "Add or change a provider" });
    await expect(providers.getByRole("listitem")).toHaveCount(8);
    await expect(providers.getByRole("button")).toHaveText([/^OpenAI/, /^Anthropic/, /^DeepSeek/, /^OpenRouter/, /^Groq/, /^Ollama \(local\)/, /^LM Studio \(local\)/, /^Custom \(OpenAI-compatible\)/]);

    // step 2: Custom takes a base URL (empty: the preset has none) and an optional key
    await providers.getByRole("button", { name: /^Custom/ }).click();
    const creds = picker(page, "Custom · credentials");
    await expect(creds.getByLabel("Base URL", { exact: true })).toBeFocused();
    await expect(creds.getByLabel("Base URL", { exact: true })).toHaveValue("");
    await expect(creds.getByLabel("API key", { exact: true })).toHaveAttribute("type", "password");
    await creds.getByRole("button", { name: "Continue" }).click();
    await expect(creds.getByRole("alert")).toHaveText("Give the base URL (it usually ends in /v1)."); // asked first, nothing sent
    await creds.getByLabel("Base URL", { exact: true }).fill(`http://127.0.0.1:${LLM_PORT}/v1`);
    await creds.getByRole("button", { name: "Continue" }).click();

    // step 3: the stand-in's list (GET /v1/models), plus a typed name
    const choose = picker(page, "Custom · choose a model");
    const radios = choose.getByRole("radiogroup", { name: "Custom models" }).getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(choose.getByRole("radio", { name: "stub-model", exact: true })).toBeChecked();
    await expect(choose.getByRole("radio", { name: "stub-model", exact: true })).toBeFocused();
    await expect(choose.getByRole("radio", { name: "stub-model-2" })).toBeVisible();
    await choose.getByRole("radio", { name: "Type a model name" }).check();
    await choose.getByLabel("Model name", { exact: true }).fill("two words");
    await choose.getByRole("button", { name: "Use this model" }).click();
    await expect(choose.getByRole("alert")).toContainText("letters, digits");
    await choose.getByRole("radio", { name: "stub-model-2" }).check();
    await choose.getByRole("button", { name: "Use this model" }).click();

    // closed: the chip says the new model, focus is back on it, and the next question goes to it
    await expect(choose).toBeHidden();
    await expect(chip(page)).toBeFocused();
    await expect(chip(page)).toHaveAccessibleName("Model: stub-model-2 (Custom, local)");
    await expect(chip(page)).toHaveText("stub-model-2");
    await ask(page, "Which model answers?");
    await expect(log(page)).toContainText("You asked: Which model answers? Model: stub-model-2.");
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(3); // never reloaded
    const saved = (await (await page.request.get("/api/assistant/models")).json()) as { providers: { name: string; preset: string; models: string[]; keySaved: boolean }[]; active: unknown };
    expect(saved.providers).toEqual([expect.objectContaining({ name: "Custom", preset: "custom", models: ["stub-model-2"], keySaved: false })]);
    await page.reload();
    await expect(chip(page)).toHaveAccessibleName("Model: stub-model-2 (Custom, local)"); // the server's file

    // one click back to the Environment from Your models
    await chip(page).click();
    await expect(yours.getByRole("menuitemradio")).toHaveCount(2);
    await expect(yours.getByRole("menuitemradio").first()).toHaveAccessibleName(/^stub-model-2 Custom/); // the active one first
    await expect(yours.getByRole("menuitemradio").first()).toHaveAttribute("aria-checked", "true");
    await yours.getByRole("menuitemradio", { name: /^stub-model Environment/ }).click();
    await expect(pick).toBeHidden();
    await expect(chip(page)).toHaveAccessibleName("Model: stub-model (Environment, local)");
    await expect(chip(page)).toBeFocused();

    // remove the Custom provider: asked first, No by default; Escape keeps it too
    await chip(page).click();
    const custom = providers.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Custom/ }) });
    await expect(custom.getByRole("button", { name: /^Custom/ })).toHaveAccessibleName(/local$/);
    await providers.getByRole("button", { name: "Remove Custom" }).click();
    const confirm = providers.getByRole("group", { name: "Remove Custom?" });
    await expect(confirm.getByRole("button", { name: "No" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(pick).toBeVisible(); // only the confirm went
    await expect(providers.getByRole("button", { name: "Remove Custom" })).toBeFocused();
    await page.keyboard.press("Enter");
    await providers.getByRole("group", { name: "Remove Custom?" }).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(providers.getByRole("button", { name: "Remove Custom" })).toHaveCount(0);
    await expect(providers.getByRole("button", { name: /^Custom \(OpenAI-compatible\)/ })).toBeFocused();
    await expect(yours.getByRole("menuitemradio")).toHaveCount(1);
    expect(((await (await page.request.get("/api/assistant/models")).json()) as { providers: unknown[] }).providers).toEqual([]);
  });

  test("a cloud provider is disabled with the reason while the server keeps data here", async ({ page }) => {
    await page.goto("/?view=assistant");
    await chip(page).click();
    const pick = picker(page, "Choose a model");
    const anthropic = pick.getByRole("button", { name: /^Anthropic/ });
    await expect(anthropic).toBeDisabled(); // aria-disabled: still focusable, so the reason is read
    await expect(anthropic).toHaveAccessibleDescription("Start the dashboard with LLM_ALLOW_REMOTE=1 to use cloud models");
    await expect(pick.getByText("Start the dashboard with LLM_ALLOW_REMOTE=1 to use cloud models")).toBeVisible();
    for (const name of ["OpenAI", "DeepSeek", "OpenRouter", "Groq"]) await expect(pick.getByRole("button", { name: new RegExp(`^${name}`) })).toBeDisabled();
    await expect(pick.getByRole("button", { name: /^Ollama/ })).toBeEnabled();
    await anthropic.click({ force: true }); // nothing happens
    await expect(pick).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Anthropic · credentials" })).toHaveCount(0);
  });

  test("a refusal stays on step 2 with the server's words", async ({ page }) => {
    await page.goto("/?view=assistant");
    await chip(page).click();
    await picker(page, "Choose a model").getByRole("button", { name: /^Custom/ }).click();
    const creds = picker(page, "Custom · credentials");
    await creds.getByLabel("Base URL", { exact: true }).fill("http://example.com/v1");
    await expect(creds.getByText("Off this machine: the dashboard uses it only when started with LLM_ALLOW_REMOTE=1.")).toBeVisible(); // the hint, before anything is sent
    await creds.getByRole("button", { name: "Continue" }).click();
    await expect(creds.getByRole("alert")).toContainText("is not on this machine");
    await creds.getByLabel("Base URL", { exact: true }).fill(`http://user:pw@127.0.0.1:${LLM_PORT}/v1`);
    await creds.getByRole("button", { name: "Continue" }).click();
    await expect(creds.getByRole("alert")).toContainText("not in the base URL");
    await expect(creds).toBeVisible();
    expect(((await (await page.request.get("/api/assistant/models")).json()) as { providers: unknown[] }).providers).toEqual([]);
  });

  test("Escape goes back a step, then closes, with focus back on the chip; the arrow keys move between rows", async ({ page }) => {
    await page.goto("/?view=assistant");
    await chip(page).click();
    const pick = picker(page, "Choose a model");
    const ollama = pick.getByRole("button", { name: /^Ollama/ });
    await ollama.focus();
    await page.keyboard.press("ArrowDown");
    await expect(pick.getByRole("button", { name: /^LM Studio/ })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(ollama).toBeFocused();
    await page.keyboard.press("Enter");
    const creds = picker(page, "Ollama · credentials");
    await expect(creds.getByLabel("Base URL", { exact: true })).toHaveValue("http://127.0.0.1:11434/v1"); // the preset's
    await expect(creds.getByLabel("Base URL", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(pick).toBeVisible();
    await expect(ollama).toBeFocused(); // the row it came from

    // Custom → step 3 → Escape keeps what was typed in step 2
    await pick.getByRole("button", { name: /^Custom/ }).click();
    const creds2 = picker(page, "Custom · credentials");
    await creds2.getByLabel("Base URL", { exact: true }).fill(`http://127.0.0.1:${LLM_PORT}/v1`);
    await creds2.getByLabel("Base URL", { exact: true }).press("Enter"); // Continue
    const choose = picker(page, "Custom · choose a model");
    await expect(choose.getByRole("radio", { name: "stub-model", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(creds2.getByLabel("Base URL", { exact: true })).toHaveValue(`http://127.0.0.1:${LLM_PORT}/v1`);
    await expect(creds2.getByLabel("Base URL", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(pick).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pick).toBeHidden();
    await expect(chip(page)).toBeFocused();
    await expect(chip(page)).toHaveAttribute("aria-expanded", "false");
    // a click outside closes it too
    await chip(page).click();
    await expect(pick).toBeVisible();
    await log(page).click({ position: { x: 20, y: 20 } });
    await expect(pick).toBeHidden();
  });

  /** Opens step 2 for Custom and types KEY in its API key field: masked, never in the markup. */
  const typeKey = async (page: Page) => {
    await chip(page).click();
    await picker(page, "Choose a model").getByRole("button", { name: /^Custom/ }).click();
    const creds = picker(page, "Custom · credentials");
    const key = creds.getByLabel("API key", { exact: true });
    await key.pressSequentially(KEY);
    await expect(key).toHaveValue(KEY);
    await expect(key).toHaveAttribute("type", "password");
    // nothing that looks like a sign-in for a password manager to offer to save
    await expect(key).toHaveAttribute("autocomplete", "off");
    for (const flag of ["data-1p-ignore", "data-lpignore", "data-bwignore"]) await expect(key).toHaveAttribute(flag, /.*/);
    await expect(creds.locator("form")).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelector("input[type=password]")?.getAttribute("value") ?? null)).toBeNull();
    expect(await page.evaluate((k) => document.documentElement.outerHTML.includes(k), KEY)).toBe(false);
    return creds;
  };
  /** No field on the page holds KEY, as its value or in the markup, and the picker is closed. */
  const keyGone = async (page: Page) => {
    await expect(page.locator(".ai-picker")).toHaveCount(0);
    expect(await page.evaluate((k) => [...document.querySelectorAll("input")].some((i) => i.value === k) || document.documentElement.outerHTML.includes(k), KEY)).toBe(false);
  };

  test("leaving the Assistant by keyboard closes the picker and forgets a key typed in it", async ({ page }) => {
    await page.goto("/?view=assistant");
    const creds = await typeKey(page);
    // Shift+Tab out of the picker (focus leaving it closes it), on to Minimize, and Enter
    const back = page.getByRole("button", { name: "Back to the dashboard" });
    for (let i = 0; i < 80 && !(await back.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Shift+Tab");
    await expect(back).toBeFocused();
    await expect(creds).toHaveCount(0); // closed as focus left it and the chip, the Assistant still shown
    await expect(chip(page)).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/view=assistant/);
    await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
    await keyGone(page);
    await tab(page).click();
    await assistantShown(page);
    await expect(chip(page)).toHaveAttribute("aria-expanded", "false");
    await keyGone(page);
  });

  test("Back out of the Assistant closes the picker with it and forgets a key typed in it", async ({ page }) => {
    await page.goto("/");
    await tab(page).click();
    await assistantShown(page);
    const creds = await typeKey(page);
    await expect(creds.getByLabel("API key", { exact: true })).toBeFocused(); // still being typed in
    await page.goBack();
    await expect(page).not.toHaveURL(/view=assistant/);
    await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
    await keyGone(page); // closed as the Assistant went, not left behind its inert stage
    await page.goForward();
    await assistantShown(page);
    await expect(chip(page)).toHaveAttribute("aria-expanded", "false");
    await keyGone(page);
    // opened again: step 2 starts empty
    await chip(page).click();
    await picker(page, "Choose a model").getByRole("button", { name: /^Custom/ }).click();
    await expect(picker(page, "Custom · credentials").getByLabel("API key", { exact: true })).toHaveValue("");
  });
});

test("a viewer sees the assistant but can't ask or read conversations", async ({ page, context }) => {
  await context.addCookies([{ name: "reconix_view", value: sessionValue("viewer", TOKEN), domain: "127.0.0.1", path: "/" }]);
  await page.goto("/?view=assistant");
  await assistantShown(page);
  await expect(page.getByText(/needs the operator role/).first()).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: /^History/ })).toBeDisabled();
  // the model chip names the model, but choosing one is the operator's: disabled, with the reason
  await expect(chip(page)).toBeDisabled();
  await expect(chip(page)).toHaveAttribute("title", "Choosing a model needs the operator role");
  await expect(chip(page)).toHaveAccessibleDescription("Choosing a model needs the operator role");
  await chip(page).click({ force: true });
  await expect(page.getByRole("dialog", { name: "Choose a model" })).toHaveCount(0);
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
