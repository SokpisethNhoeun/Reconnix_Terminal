/* The dashboard ↔ AI Assistant transition (components/assistant/motion.ts, assistant-stage.tsx):
   its directions and timing sampled frame by frame, the one globe carried behind the welcome and
   faded out once the conversation starts, the history entry and rapid clicks, the direct address,
   phones and reduced motion. The globe runs on SwiftShader here, so the timing tests hide its
   canvas (the carrier still travels) to keep the frames coming. */
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./support";

test.use({
  launchOptions: {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

const tab = (page: Page) => page.locator('nav[aria-label="Views"] button[aria-label="AI Assistant"]');
const minimize = (page: Page) => page.getByRole("button", { name: "Back to the dashboard" }).click({ force: true });
const composer = (page: Page) => page.getByRole("textbox", { name: /^Ask about/ }).last();
const settled = (page: Page) => expect(page.locator(".dash-frame[data-breathing]")).toHaveCount(1, { timeout: 5000 });
const closed = (page: Page) => expect(page.locator(".dash-assistant-stage[data-on]")).toHaveCount(0, { timeout: 5000 });

// The Overview's groups, by the data-motion contract. TEMPORARY: or by today's class names until
// the dashboard branch (which adds data-motion) is merged; the main agent removes the fallback.
const PARTS = {
  topbar: ".dash-frame > header",
  right: ':is([data-motion="right"], .dash-right)',
  bottom: ':is([data-motion="bottom"], .dash-bottom)',
  hero: ':is([data-motion="hero"], .dash-hero)',
  fade: ':is([data-motion="fade"], .dash-hero-title)',
  surface: ".dash-assistant-surface",
  front: ".dash-assistant-front",
  stage: ".dash-assistant-stage",
  carrier: ".dash-globe-carrier",
} as const;
type Name = keyof typeof PARTS;
type Sample = { box: { x: number; y: number; w: number; h: number }; o: number; tx: number; ty: number; s: number } | null;
type Frame = Record<Name, Sample> & { t: number; pieces: number[]; settled: boolean };

/** Every frame for `ms` after the next pointerdown: each part's box, opacity and transform. */
function sample(page: Page, ms: number): Promise<Frame[]> {
  return page.evaluate(
    ({ parts, ms }) =>
      new Promise<Frame[]>((resolve) => {
        const out: Frame[] = [];
        let clickAt: number | null = null;
        document.addEventListener("pointerdown", () => (clickAt ??= performance.now()), { capture: true, once: true });
        const read = (selector: string): Sample => {
          const el = document.querySelector<HTMLElement>(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const m = new DOMMatrixReadOnly(cs.transform === "none" ? undefined : cs.transform);
          return { box: { x: r.x, y: r.y, w: r.width, h: r.height }, o: Number(cs.opacity) * (cs.visibility === "hidden" ? 0 : 1), tx: m.e, ty: m.f, s: m.a };
        };
        const tick = () => {
          if (clickAt !== null) {
            const frame = { t: performance.now() - clickAt } as Frame;
            for (const [name, selector] of Object.entries(parts)) frame[name as Name] = read(selector);
            frame.pieces = [...document.querySelectorAll("[data-assistant-piece]")].map((p) => Number(getComputedStyle(p).opacity));
            frame.settled = document.querySelector(".dash-frame")!.hasAttribute("data-breathing");
            out.push(frame);
            if (frame.t > ms) return resolve(out);
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { parts: PARTS, ms },
  );
}

/** The first and last frame times at which `pick` changes by more than `eps`. */
function moves(frames: Frame[], pick: (f: Frame) => number, eps = 0.5): [number, number] {
  let first = -1;
  let last = -1;
  for (let i = 1; i < frames.length; i++) {
    if (Math.abs(pick(frames[i]) - pick(frames[i - 1])) > eps) {
      if (first < 0) first = frames[i - 1].t;
      last = frames[i].t;
    }
  }
  return [first, last];
}

async function ready(page: Page) {
  await signIn(page);
  await expect(page.locator(".dash-askbar")).toBeVisible();
  await page.waitForTimeout(2600); // the intro's reveal
}
const hideCanvas = (page: Page) => page.addStyleTag({ content: ".dash-globe-canvas { display: none !important; }" });

test("opening grows the hero into the assistant while the dashboard leaves, closing reverses it", async ({ page }) => {
  await ready(page);
  await hideCanvas(page);
  const recording = sample(page, 2300);
  await tab(page).click();
  const open = await recording;
  const first = open[0];
  const last = open.at(-1)!;
  const hero = first.hero!.box;

  // the four directions, all fading
  expect(last.topbar!.ty).toBeLessThanOrEqual(-first.topbar!.box.h + 1);
  expect(last.right!.tx).toBeGreaterThanOrEqual(100);
  expect(last.bottom!.ty).toBeGreaterThanOrEqual(100);
  for (const part of ["topbar", "right", "bottom", "fade"] as const) expect(last[part]!.o).toBe(0);
  // the hero text goes first; the top bar, right column and bottom row leave in that order, overlapping
  const fadeEnd = open.find((f) => f.fade!.o === 0)!.t;
  expect(fadeEnd).toBeLessThan(500);
  const [topStart] = moves(open, (f) => f.topbar!.ty);
  const [rightStart] = moves(open, (f) => f.right!.tx);
  const [bottomStart, bottomEnd] = moves(open, (f) => f.bottom!.ty);
  expect(topStart).toBeLessThanOrEqual(rightStart);
  expect(rightStart).toBeLessThanOrEqual(bottomStart);
  expect(bottomEnd).toBeGreaterThan(800);
  expect(bottomEnd).toBeLessThan(1400);

  // the surface: from the hero's box to the whole stage, growing the whole time it moves
  const growing = open.filter((f) => f.t > 60);
  const start = growing[0].surface!.box;
  expect(Math.abs(start.x - hero.x)).toBeLessThan(4);
  expect(Math.abs(start.w - hero.w)).toBeLessThan(6);
  expect(Math.abs(start.h - hero.h)).toBeLessThan(6);
  const stage = last.stage!.box;
  expect(last.surface!.box).toEqual(stage);
  for (let i = 1; i < growing.length; i++) expect(growing[i].surface!.box.w).toBeGreaterThanOrEqual(growing[i - 1].surface!.box.w - 0.5);
  const [growStart, growEnd] = moves(open, (f) => f.surface!.box.w);
  expect(growStart).toBeLessThan(bottomEnd); // continuous: it grows while the dashboard is still leaving
  expect(growEnd).toBeGreaterThan(1100);
  expect(growEnd).toBeLessThan(1700);

  // the pieces come in at the end; the whole open lands in about 1.6 s
  expect(open.filter((f) => f.t > 100 && f.t < 900).every((f) => f.pieces.every((o) => o === 0))).toBe(true);
  const landed = open.find((f) => f.settled)!.t;
  expect(landed).toBeGreaterThan(1450);
  expect(landed).toBeLessThan(2100);
  expect(open.find((f) => f.settled)!.pieces.every((o) => o === 1)).toBe(true);
  await expect(composer(page)).toBeFocused();

  // close: the reverse, about 1.4 s, back onto the hero box
  const recordingClose = sample(page, 2000);
  await minimize(page);
  const close = await recordingClose;
  expect(close.find((f) => f.t > 400)!.pieces.every((o) => o < 0.05)).toBe(true); // the chat goes first
  const onHero = close.find((f) => f.t > 100 && Math.abs(f.surface!.box.w - hero.w) < 6 && Math.abs(f.surface!.box.h - hero.h) < 6)!;
  expect(onHero.t).toBeGreaterThan(700);
  expect(onHero.t).toBeLessThan(1300);
  const back = close.find((f) => f.t > 200 && f.topbar!.ty === 0 && f.right!.tx === 0 && f.bottom!.ty === 0 && f.fade!.o === 1)!;
  expect(back.t).toBeGreaterThan(1150);
  expect(back.t).toBeLessThan(1800);
  await closed(page);
  await expect(tab(page)).toBeFocused(); // the opener
});

test("the one globe sits behind the welcome at about 0.18, fades out once the conversation starts, and returns", async ({ page }) => {
  await ready(page);
  await expect(page.locator(PARTS.carrier)).toHaveCount(1);
  const canvas = page.locator(".dash-globe-canvas");
  await expect(canvas, "the globe needs WebGL (SwiftShader here)").toHaveAttribute("data-globe", "running");
  await tab(page).click();
  await settled(page);
  const carrier = page.locator(PARTS.carrier);
  await expect(page.locator(`.dash-assistant-globe ${PARTS.carrier}`)).toHaveCount(1); // carried, not copied
  await expect(page.locator("canvas")).toHaveCount(1);
  const opacity = () => carrier.evaluate((el) => Number(getComputedStyle(el).opacity));
  await expect.poll(opacity).toBeCloseTo(0.18, 2);
  await expect(canvas).toHaveAttribute("data-globe", "running");

  await composer(page).fill("Which runs wait on me?");
  await composer(page).press("Enter");
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText("Stub answer");
  await expect.poll(opacity).toBe(0);
  await expect(canvas).toHaveAttribute("data-globe", "paused"); // it stops drawing

  await page.getByRole("button", { name: /new (chat|conversation)/i }).click({ force: true });
  await expect.poll(opacity).toBeCloseTo(0.18, 2);
  await expect(canvas).toHaveAttribute("data-globe", "running");

  await minimize(page);
  await closed(page);
  await expect(page.locator(`.dash-globe-wrap ${PARTS.carrier}`)).toHaveCount(1); // home again
  await expect.poll(opacity).toBe(1);
});

test("no reload, one history entry per open, and rapid clicks leave nothing stuck", async ({ page }) => {
  await ready(page);
  await hideCanvas(page);
  await page.evaluate(() => ((window as unknown as { kept: number }).kept = 7));
  const length = () => page.evaluate(() => history.length);
  const before = await length();
  await tab(page).click();
  await tab(page).click(); // open (or opening) already: nothing more
  expect(await length()).toBe(before + 1);
  await settled(page);
  await page.goBack();
  await closed(page);
  await expect(page).not.toHaveURL(/view=assistant/);

  const overview = page.locator('nav[aria-label="Views"] button[aria-label="Overview"]');
  for (let i = 0; i < 8; i++) {
    await (i % 2 ? overview : tab(page)).click();
    await page.waitForTimeout(60 + i * 35);
  }
  await page.waitForTimeout(2200);
  expect(await length()).toBeLessThanOrEqual(before + 1);
  const state = await page.evaluate((parts) => {
    const inline = [parts.topbar, parts.right, parts.bottom, parts.fade].map((s) => {
      const el = document.querySelector<HTMLElement>(s)!;
      return el.style.transform || el.style.opacity;
    });
    return {
      open: new URLSearchParams(location.search).get("view") === "assistant",
      on: document.querySelector(".dash-assistant-stage")!.hasAttribute("data-on"),
      breathing: document.querySelector(".dash-frame")!.hasAttribute("data-breathing"),
      carriedIn: document.querySelector(parts.carrier)!.parentElement!.className,
      inline: inline.filter(Boolean).length,
    };
  }, PARTS);
  if (state.open) expect(state).toMatchObject({ on: true, breathing: true, carriedIn: "dash-assistant-globe-breath" });
  else expect(state).toEqual({ open: false, on: false, breathing: false, carriedIn: "dash-globe-wrap", inline: 0 });
  expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(7);
});

test("the direct address opens the assistant with no box to grow from", async ({ page }) => {
  await signIn(page);
  await page.goto("/assistant");
  await expect(page).toHaveURL(/\/\?view=assistant$/);
  await expect(page.getByRole("heading", { name: "AI Assistant", level: 1 })).toBeVisible();
  await settled(page);
  await expect(composer(page)).toBeFocused();
  await expect(page.locator(`.dash-assistant-globe ${PARTS.carrier}`)).toHaveCount(1);
  await expect.poll(() => page.locator(PARTS.carrier).evaluate((el) => Number(getComputedStyle(el).opacity))).toBeCloseTo(0.18, 2);
  await minimize(page);
  await closed(page);
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await expect(page.locator(`.dash-globe-wrap ${PARTS.carrier}`)).toHaveCount(1);
  await expect(page.locator(PARTS.right)).toHaveCSS("transform", "none");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("it crossfades instead of growing, and the composer stays in reach", async ({ page }) => {
    await ready(page);
    await hideCanvas(page);
    const recording = sample(page, 1000);
    await tab(page).click();
    const open = await recording;
    const stageWidth = open.at(-1)!.stage!.box.w;
    for (const f of open.filter((f) => f.t > 60)) expect(Math.abs(f.surface!.box.w - stageWidth)).toBeLessThan(1); // no grow
    const [fadeStart, fadeEnd] = moves(open, (f) => f.front!.o, 0.01);
    expect(fadeStart).toBeGreaterThanOrEqual(0);
    expect(fadeEnd).toBeLessThan(600);
    await settled(page);
    await expect(composer(page)).toBeFocused();
    const box = (await composer(page).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await composer(page).fill("still usable");
    await expect(composer(page)).toHaveValue("still usable");
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a short crossfade, nothing moves, and a still halo instead of the loops", async ({ page }) => {
    await ready(page);
    const recording = sample(page, 900);
    await tab(page).click();
    const open = await recording;
    for (const f of open) {
      for (const part of ["topbar", "right", "bottom"] as const) expect([f[part]!.tx, f[part]!.ty]).toEqual([0, 0]);
      expect(f.surface!.box.w).toBe(open.at(-1)!.stage!.box.w);
    }
    const [, fadeEnd] = moves(open, (f) => f.front!.o, 0.01);
    expect(fadeEnd).toBeLessThan(450);
    await settled(page);
    for (const selector of [".dash-ai-icon", ".dash-ai-halo", ".dash-assistant-panel", ".dash-assistant-card", ".dash-assistant-globe-breath"]) {
      await expect(page.locator(selector).first()).toHaveCSS("animation-name", "none");
    }
    await expect.poll(() => page.locator(".dash-ai-halo").evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.3);
    await minimize(page);
    await closed(page);
    await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  });
});
