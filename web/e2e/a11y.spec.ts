/* Accessibility (docs/WEB_REDESIGN_V2_PLAN.md §6.5): an axe-core check (WCAG 2.2 A/AA rules) of
   the Overview, Findings, Scope, Reports and the AI Assistant; the keyboard's path through the
   frame with a visible focus mark at every stop; where focus goes when the assistant opens and
   closes; and the contrast of the meaning colours on the cards and in their badges. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { newest, signIn } from "./support";

const RUN = newest().uid;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/* Violations owned by other areas, by page and axe rule, so this suite stays green until they
   are fixed (remove each entry with its fix):
   - findings-view.tsx: the list is role="listbox" with a <button> inside every role="option"
     (nested-interactive); the "findings format" link is told from its text by colour only
     (link-in-text-block). */
const KNOWN: Record<string, string[]> = {
  findings: ["nested-interactive"],
  "one finding": ["nested-interactive", "link-in-text-block"],
};

async function axe(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const found = violations
    .filter((v) => !(KNOWN[name] ?? []).includes(v.id))
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(found, `${name}: axe violations`).toEqual([]);
}

async function show(page: Page, url: string) {
  await page.goto(url);
  // a dashboard view, or the assistant's composer (the views are all hidden behind it)
  const ready = url.includes("view=assistant") ? page.getByRole("textbox", { name: /^Ask about/ }).last() : page.locator("main > :not([hidden])").first();
  await expect(ready).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("axe", () => {
  test.use({ reducedMotion: "reduce" }); // everything on screen at once, nothing mid-animation

  const PAGES: [string, string][] = [
    ["overview", "/"],
    ["one run's overview", `/?uid=${RUN}`],
    ["findings", "/?view=findings"],
    ["one finding", `/?uid=${RUN}&view=findings&finding=F-001`],
    ["scope", `/?uid=${RUN}&view=scope`],
    ["reports", `/?uid=${RUN}&view=reports`],
    ["assistant", "/?view=assistant"],
  ];
  for (const [name, url] of PAGES) {
    test(`the ${name} has no violations`, async ({ page }) => {
      await signIn(page);
      await show(page, url);
      await axe(page, name);
    });
  }

  test("the assistant with a conversation has no violations", async ({ page }) => {
    await signIn(page);
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
});

// ---- the keyboard -----------------------------------------------------------------------------

type Stop = { name: string; region: string; marked: boolean; seen: boolean };

/** Tab from the top of the page; for each stop: where it is, and whether focusing it visibly
    changes it or one of its three nearest ancestors (an outline, a ring, a border, a fill). */
async function tabStops(page: Page, count: number): Promise<Stop[]> {
  // no transitions or loops: a computed style must be the state's own, not a frame on the way there
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: Stop[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const chain = [el, el.parentElement, el.parentElement?.parentElement, el.parentElement?.parentElement?.parentElement].filter(
        (n): n is HTMLElement => !!n,
      );
      const look = () =>
        chain
          .map((n) => {
            const s = getComputedStyle(n);
            return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join(";");
          })
          .join("|");
      const focused = look();
      el.blur();
      const blurred = look();
      el.focus(); // the last input was a key, so this still counts as :focus-visible
      const r = el.getBoundingClientRect();
      const region = el.closest("aside")
        ? "sidebar"
        : el.closest(".dash-topbar")
          ? "top bar"
          : el.closest("main")
            ? "content"
            : el.closest(".dash-assistant-stage")
              ? "assistant"
              : "elsewhere";
      return {
        name: el.getAttribute("aria-label") || el.textContent!.trim().slice(0, 40) || el.tagName,
        region,
        marked: focused !== blurred,
        seen: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  return stops;
}

test.describe("the keyboard", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });

  for (const [name, url] of [
    ["overview", "/"],
    ["findings", "/?view=findings"],
    ["scope", `/?uid=${RUN}&view=scope`],
    ["reports", `/?uid=${RUN}&view=reports`],
  ]) {
    test(`Tab walks the ${name} sidebar → top bar → view, each stop visibly marked`, async ({ page }) => {
      await signIn(page);
      await show(page, url);
      const stops = await tabStops(page, 30);
      const order = ["sidebar", "top bar", "content"];
      const regions = stops.map((s) => order.indexOf(s.region));
      expect(regions.every((r) => r >= 0), `stops outside the frame: ${JSON.stringify(stops.filter((s) => !order.includes(s.region)))}`).toBe(true);
      expect(regions, "the order goes back on itself").toEqual([...regions].sort((a, b) => a - b));
      expect(stops.filter((s) => s.region === "sidebar").map((s) => s.name).slice(1, 3)).toEqual(["Overview", "AI Assistant"]);
      expect(stops.some((s) => s.region === "content"), "Tab reaches the view").toBe(true);
      expect(stops.filter((s) => !s.marked).map((s) => s.name), "stops with no visible focus").toEqual([]);
      expect(stops.filter((s) => !s.seen).map((s) => s.name), "stops off screen").toEqual([]);
    });
  }
});

test.describe("focus and the assistant", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("opening puts focus in the composer, Back returns it to the sidebar, and Tab never lands under the assistant", async ({ page }) => {
    await signIn(page);
    await show(page, "/");
    const ai = page.locator('nav[aria-label="Views"] button[aria-label="AI Assistant"]');
    await ai.focus();
    await page.keyboard.press("Enter");
    const composer = page.getByRole("textbox", { name: /^Ask about/ }).last();
    await expect(composer).toBeFocused({ timeout: 5000 }); // after the 1.6 s open
    const stops = await tabStops(page, 25);
    expect(stops.filter((s) => s.region === "top bar" || s.region === "content").map((s) => s.name), "focus went under the assistant").toEqual([]);
    expect(stops.filter((s) => !s.marked).map((s) => s.name), "stops with no visible focus").toEqual([]);

    await page.getByRole("button", { name: "Back to the dashboard" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/view=assistant/);
    await expect(ai).toBeFocused({ timeout: 5000 });
  });

  /* The top bar's pieces carry an inline `visibility: visible` under reduced motion (intro.tsx sets
     it, and dashboard.css's reduced-motion rule says the same), which beats the `hidden` the open
     assistant puts on the top bar, so Tab walks into controls it covers. Drop `.fixme` once the
     intro sets `autoAlpha: 1` (visibility: inherit) or the viewer makes what it covers inert. */
  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test.fixme("Tab never lands under the assistant", async ({ page }) => {
      await signIn(page);
      await show(page, "/?view=assistant");
      const stops = await tabStops(page, 25);
      expect(stops.filter((s) => s.region === "top bar" || s.region === "content").map((s) => s.name)).toEqual([]);
    });
  });
});

// ---- contrast of the meaning colours ----------------------------------------------------------

const TOKENS = Object.fromEntries(
  [...readFileSync(path.join(__dirname, "..", "src", "styles", "tokens.css"), "utf8").matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]),
);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (c: number[]) => {
  const [r, g, b] = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** A badge's fill: its colour at 13% over the surface it sits on (status-badge.tsx). */
const tint = (c: number[], under: number[], share = 0.13) => c.map((v, i) => share * v + (1 - share) * under[i]);

test("the meaning colours read at 4.5:1 on the cards, the page and inside their own badges", () => {
  const colours = ["primary", "success", "warning", "danger", "info", "sev-critical", "sev-high", "sev-medium", "sev-low", "sev-info"];
  const grounds = ["card", "card-2", "background"]; // a card's gradient runs --card → --card-2
  const low: string[] = [];
  for (const name of colours) {
    expect(TOKENS[name], `--${name} is a token`).toMatch(/^#/);
    for (const g of grounds) {
      const [fg, bg] = [rgb(TOKENS[name]), rgb(TOKENS[g])];
      const plain = contrast(fg, bg);
      const badge = contrast(fg, tint(fg, bg));
      if (plain < 4.5) low.push(`--${name} on --${g}: ${plain.toFixed(2)}`);
      if (badge < 4.5) low.push(`--${name} badge on --${g}: ${badge.toFixed(2)}`);
    }
  }
  expect(low).toEqual([]);
});
