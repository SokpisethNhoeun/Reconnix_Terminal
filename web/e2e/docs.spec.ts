/* The documentation (docs/WEB_REDESIGN_V3_PLAN.md, workstream E5): the sidebar lists every group,
   a command page has its sections, code blocks carry a Copy button, the docs search finds a
   command, every old address redirects to a live page, and on a phone the tree folds behind the
   "Docs menu" button with nothing overflowing sideways. */
import { expect, test } from "./fixtures";

import { PORT } from "../playwright.config";
import { DOCS_REDIRECTS } from "../src/lib/docs-redirects";
import { DOCS_ROUTES } from "../src/lib/docs-nav";
import { signIn } from "./support";

const ORIGIN = `http://127.0.0.1:${PORT}`;

/* The group titles of src/lib/docs-nav.ts (kept here as data, so the spec needs no React import). */
const GROUPS = [
  "Overview",
  "Getting started",
  "Terminal guide",
  "AI models",
  "Commands",
  "Security assessment guide",
  "Reports",
  "Troubleshooting",
  "Guardrails",
];

const sidebar = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Documentation", exact: true });

test("the docs open in the dashboard's frame, with Documentation marked in its sidebar", async ({ page }) => {
  await page.goto("/docs/commands/model");
  const views = page.getByRole("navigation", { name: "Views" });
  await expect(views.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
  await expect(views.getByRole("link", { name: "Findings" })).toHaveAttribute("href", "/?view=findings");
  // the dashboard's views, without the removed Scope view
  expect(await views.getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("data-view")))).toEqual([
    "overview",
    "assistant",
    "assessments",
    "findings",
    "reports",
    "terminal",
  ]);
  await expect(views.getByRole("link", { name: "Scope" })).toHaveCount(0);
  const docs = page.getByRole("link", { name: "Documentation", exact: true });
  await expect(docs).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Configuration", exact: true })).not.toHaveAttribute("aria-current", "page");
  await expect(page.locator(".dash-frame .dash-content h1")).toHaveText("/model");
  await views.getByRole("link", { name: "Findings" }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("view") === "findings");
  await expect(page.locator('nav[aria-label="Views"] button[aria-label="Findings"]')).toHaveAttribute("aria-current", "page");
});

test("the sidebar lists every group and marks the current page", async ({ page }) => {
  await page.goto("/docs/terminal-guide/keys");
  const nav = sidebar(page);
  for (const title of GROUPS) await expect(nav.getByRole("link", { name: title, exact: true })).toBeVisible();
  // the current page's group is open and the page is marked; another group is folded
  await expect(nav.getByRole("link", { name: "Keys", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "Collapse Terminal guide" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Expand Commands" })).toBeVisible();
  await nav.getByRole("button", { name: "Expand Commands" }).click();
  await expect(nav.getByRole("link", { name: "/model", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link")).not.toHaveCount(0);
});

test("a command page shows its facts and sections", async ({ page }) => {
  await page.goto("/docs/commands/model");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("/model");
  for (const h of ["Purpose", "When to use it", "Syntax", "Example", "What happens", "Common errors"]) {
    await expect(page.getByRole("heading", { level: 2, name: h, exact: true })).toBeVisible();
  }
  await expect(page.locator("dl")).toContainText("/models"); // the alias
  await expect(page.locator("pre").first()).toContainText("/model [<provider>/<model>]");
  // the error table's meaning column keeps room to read (a long key never squeezes it)
  await page.goto("/docs/commands/import");
  const widths = await page.locator("table.docs-table td").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(widths.length).toBeGreaterThan(5);
  for (const w of widths) expect(w).toBeGreaterThanOrEqual(220);
  // the index lists every area with this command in it
  await page.goto("/docs/commands");
  await expect(page.getByRole("heading", { level: 2, name: "AI models & agent" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/model", exact: true }).first()).toBeVisible();
});

test("every code block has a Copy button that copies its text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
  await page.goto("/docs/getting-started/launching");
  await expect(page.locator("html[data-hydrated]")).toHaveCount(1); // hydrated: the buttons are live
  const blocks = page.locator("pre");
  const buttons = page.getByRole("button", { name: "Copy code" });
  await expect(buttons).toHaveCount(await blocks.count());
  await buttons.first().click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible(); // the label follows the state
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("python -m reconix");
});

test("the docs search finds /model and opens its page", async ({ page }) => {
  await page.goto("/docs");
  const box = page.getByRole("combobox", { name: "Search the documentation" });
  await box.fill("/model");
  const results = page.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("option").first()).toContainText("/model");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/docs\/commands\/model$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("/model");
  // a section heading is a hit too, and opens the page at that section
  await box.fill("double check");
  await expect(results.getByRole("option").first()).toContainText("Approval gates");
  await results.getByRole("option").first().click();
  await expect(page).toHaveURL(/\/docs\/assessment-guide\/approval-gates#high-risk-the-double-check$/);
});

test("every documentation page answers 200 and has one h1", async ({ page }) => {
  expect(DOCS_ROUTES.length, "the docs have pages").toBeGreaterThan(30);
  const broken: string[] = [];
  for (const route of DOCS_ROUTES) {
    const res = await page.request.get(route);
    if (res.status() !== 200) {
      broken.push(`${route}: ${res.status()}`);
      continue;
    }
    // the page, not just the route: one h1 in the served HTML
    const h1s = (await res.text()).match(/<h1[\s>]/g)?.length ?? 0;
    if (h1s !== 1) broken.push(`${route}: ${h1s} h1 elements`);
  }
  expect(broken).toEqual([]);
});

test("a search with no match opens nothing, and Enter stays on the page", async ({ page }) => {
  await page.goto("/docs");
  const box = page.getByRole("combobox", { name: "Search the documentation" });
  await box.fill("zzz-no-such-topic");
  await expect(box).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("option")).toHaveCount(0);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/docs$/);
});

test("the search results move with ArrowDown and ArrowUp, and Escape closes them", async ({ page }) => {
  await page.goto("/docs");
  const box = page.getByRole("combobox", { name: "Search the documentation" });
  await box.fill("model");
  const options = page.getByRole("listbox", { name: "Search results" }).getByRole("option");
  expect(await options.count()).toBeGreaterThan(1);
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await box.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "false");
  await box.press("ArrowUp");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await box.press("ArrowDown");
  const second = (await options.nth(1).locator("span").first().textContent())!;
  await box.press("Escape");
  await expect(box).toHaveAttribute("aria-expanded", "false");
  await expect(options).toHaveCount(0);
  // typing again opens it; the arrows and Enter open the page that was highlighted
  await box.fill("model");
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(second);
});

test("the box names the active result, keeps it in range when the hits shrink, opens it with Enter, and an option opens on click", async ({ page }) => {
  await page.goto("/docs");
  const box = page.getByRole("combobox", { name: "Search the documentation" });
  const options = page.getByRole("listbox", { name: "Search results" }).getByRole("option");
  const activeId = async () => (await box.getAttribute("aria-activedescendant"))!;
  await box.fill("model");
  const many = await options.count();
  expect(many).toBeGreaterThan(2);
  expect(await activeId()).toBe(await options.nth(0).getAttribute("id"));
  for (let i = 0; i < many - 1; i++) await box.press("ArrowDown");
  expect(await activeId()).toBe(await options.nth(many - 1).getAttribute("id")); // the last one
  await box.press("ArrowDown"); // and no further
  expect(await activeId()).toBe(await options.nth(many - 1).getAttribute("id"));
  await box.press("ArrowUp");
  expect(await activeId()).toBe(await options.nth(many - 2).getAttribute("id"));
  // fewer hits: the active one is clamped to one that exists, and it is the one marked
  await box.fill("/model");
  const few = await options.count();
  expect(few).toBeLessThan(many);
  const marked = page.getByRole("listbox", { name: "Search results" }).getByRole("option", { selected: true });
  await expect(marked).toHaveCount(1);
  expect(await activeId()).toBe(await marked.getAttribute("id"));
  expect(await page.locator(`[id="${await activeId()}"]`).count()).toBe(1); // it points at an element
  await box.press("Escape");
  await expect(box).not.toHaveAttribute("aria-activedescendant", /./);
  await expect(options).toHaveCount(0);
  await box.fill("/model");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/docs\/commands\/model$/);
  await box.fill("export");
  await expect(options.first()).toBeVisible();
  const chosen = (await options.first().locator("span").first().textContent())!;
  await options.first().click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(chosen);
});

test("every old docs address redirects to a page that exists", async ({ page }) => {
  await signIn(page);
  for (const r of DOCS_REDIRECTS) {
    const res = await page.request.get(r.source, { maxRedirects: 0 });
    expect(res.status(), r.source).toBe(308);
    expect(res.headers().location, r.source).toBe(r.destination);
  }
  for (const source of ["/docs/getting-started/configuration", "/docs/reference/findings", "/docs/architecture"]) {
    const res = await page.goto(source);
    expect(res!.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${DOCS_REDIRECTS.find((r) => r.source === source)!.destination}$`));
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the tree folds behind the Docs menu button and nothing overflows sideways", async ({ page }) => {
    await page.goto("/docs/commands/export");
    const button = page.getByRole("button", { name: "Docs menu" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar(page)).toBeHidden();
    await expect(page.getByRole("combobox", { name: "Search the documentation" })).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole("link", { name: "/finding", exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/commands\/finding$/);
    await expect(sidebar(page)).toBeHidden(); // closed again after choosing a page
    for (const url of ["/docs/commands/finding", "/docs/terminal-guide/keys", "/docs/ai-models/errors", "/docs/commands/import"]) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth);
      expect(overflow, `${url} overflows sideways`).toBeLessThanOrEqual(0);
    }
    // the tables stack: every meaning cell is as wide as the table, never squeezed by a long key
    const widths = await page.locator("table.docs-table td").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(300);
  });

  test("a code block that scrolls sideways is a tab stop named Code, and one that fits is not", async ({ page }) => {
    // /provider's syntax line is the longest of the commands: wider than a phone
    await page.goto("/docs/commands/provider");
    await expect(page.locator('.docs-code pre[tabindex="0"]').first()).toBeVisible(); // hydrated and measured
    const blocks = await page.locator(".docs-code pre").evaluateAll((els) =>
      els.map((el) => ({
        scrolls: el.scrollWidth > el.clientWidth + 1, // ScrollRegion's own tolerance
        stop: el.getAttribute("tabindex") === "0" && el.getAttribute("role") === "region" && el.getAttribute("aria-label") === "Code",
      })),
    );
    expect(blocks.some((b) => b.scrolls), "a block that scrolls at phone width").toBe(true);
    for (const b of blocks) expect(b.stop, "a tab stop exactly when it scrolls").toBe(b.scrolls);
    const stop = page.locator('.docs-code pre[tabindex="0"]').first();
    await stop.focus();
    await expect(stop).toBeFocused();
    await expect(stop).toHaveCSS("outline-style", "solid"); // the focus mark (.ui-scroll-region)
  });
});
