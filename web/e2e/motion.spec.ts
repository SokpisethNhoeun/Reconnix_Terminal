/* The dashboard ↔ AI Assistant transition (components/assistant/motion.ts, assistant-stage.tsx):
   its directions and timing sampled frame by frame, the one globe carried behind the welcome and
   faded out once the conversation starts, the history entry and rapid clicks, the direct address,
   phones and reduced motion. The globe runs on SwiftShader here, so the timing tests hide its
   canvas (the carrier still travels) to keep the frames coming. Times are measured from the first
   frame that moves, with room for a slow (2–4 core) machine. */
import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./support";

test.use({
  launchOptions: {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

const tab = (page: Page) => page.locator('nav[aria-label="Views"] button[aria-label="AI Assistant"]');
const nav = (page: Page, name: string) => page.locator(`nav[aria-label="Views"] button[aria-label^="${name}"]`);
const minimize = (page: Page) => page.getByRole("button", { name: "Back to the dashboard" }).click({ force: true });
const composer = (page: Page) => page.getByRole("textbox", { name: /^Ask about/ }).last();
const settled = (page: Page) => expect(page.locator(".dash-frame[data-breathing]")).toHaveCount(1, { timeout: 8000 });
const closed = (page: Page) => expect(page.locator(".dash-assistant-stage[data-on]")).toHaveCount(0, { timeout: 8000 });
const canvas = (page: Page) => page.locator(".dash-globe-canvas");
const carrierOpacity = (page: Page) => page.locator(".dash-globe-carrier").evaluate((el) => Number(getComputedStyle(el).opacity));

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
          const o = Number(cs.opacity) * (cs.visibility === "hidden" ? 0 : 1);
          return { box: { x: r.x, y: r.y, w: r.width, h: r.height }, o, tx: m.e, ty: m.f, s: m.a };
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

/** Signed in, with the intro's reveal over: the frame unscaled and the parts still for 5 frames. */
async function ready(page: Page) {
  await signIn(page);
  await page.waitForFunction(
    (parts) =>
      new Promise<boolean>((resolve) => {
        const key = () => {
          const frame = document.querySelector(".dash-frame");
          if (!frame || getComputedStyle(frame).transform !== "none") return null;
          const els = [parts.topbar, parts.right, parts.bottom, parts.hero, parts.fade, ".dash-navbtn"].map((s) =>
            document.querySelector<HTMLElement>(s),
          );
          if (els.some((el) => !el || getComputedStyle(el).opacity !== "1")) return null;
          return els.map((el) => JSON.stringify(el!.getBoundingClientRect())).join("|");
        };
        let last = key();
        let still = 0;
        const tick = () => {
          const now = key();
          still = now !== null && now === last ? still + 1 : 0;
          last = now;
          if (still >= 5) resolve(true);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    PARTS,
    { timeout: 20_000 },
  );
}
const hideCanvas = (page: Page) => page.addStyleTag({ content: ".dash-globe-canvas { display: none !important; }" });

test("opening grows the hero into the assistant while the dashboard leaves, closing reverses it", async ({ page }) => {
  await ready(page);
  await hideCanvas(page);
  const recording = sample(page, 2600);
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
  // from the first frame that moves: the hero text goes first; the top bar, right column and
  // bottom row leave in that order, overlapping
  const [t0] = moves(open, (f) => f.topbar!.ty);
  const after = (f: Frame) => f.t - t0;
  expect(after(open.find((f) => f.fade!.o === 0)!)).toBeLessThan(650);
  const [rightStart] = moves(open, (f) => f.right!.tx);
  const [bottomStart, bottomEnd] = moves(open, (f) => f.bottom!.ty);
  expect(rightStart).toBeGreaterThanOrEqual(t0);
  expect(bottomStart).toBeGreaterThanOrEqual(rightStart);
  expect(bottomEnd - t0).toBeGreaterThan(700);
  expect(bottomEnd - t0).toBeLessThan(1500);

  // the surface: from the hero's box to the whole stage, growing the whole time it moves
  const growing = open.filter((f) => f.t > t0);
  const start = growing[0].surface!.box;
  expect(Math.abs(start.x - hero.x)).toBeLessThan(4);
  expect(Math.abs(start.w - hero.w)).toBeLessThan(6);
  expect(Math.abs(start.h - hero.h)).toBeLessThan(6);
  expect(last.surface!.box).toEqual(last.stage!.box);
  for (let i = 1; i < growing.length; i++) expect(growing[i].surface!.box.w).toBeGreaterThanOrEqual(growing[i - 1].surface!.box.w - 0.5);
  const [growStart, growEnd] = moves(open, (f) => f.surface!.box.w);
  expect(growStart).toBeLessThan(bottomEnd); // continuous: it grows while the dashboard is still leaving
  expect(growEnd - t0).toBeGreaterThan(1000);
  expect(growEnd - t0).toBeLessThan(1900);

  // the pieces come in at the end; the whole open lands in about 1.6 s
  expect(open.filter((f) => f.t > t0 + 50 && f.t < t0 + 850).every((f) => f.pieces.every((o) => o === 0))).toBe(true);
  const landed = open.find((f) => f.settled)!;
  expect(landed.t - t0).toBeGreaterThan(1400);
  expect(landed.t - t0).toBeLessThan(2300);
  expect(landed.pieces.every((o) => o === 1)).toBe(true);
  await expect(composer(page)).toBeFocused();

  // close: the reverse, about 1.4 s, back onto the hero box
  const recordingClose = sample(page, 2200);
  await minimize(page);
  const close = await recordingClose;
  const c0 = close.find((f) => f.pieces.some((o) => o < 0.99))!.t; // the close's first frame
  expect(close.find((f) => f.t > c0 + 450)!.pieces.every((o) => o < 0.05)).toBe(true); // the chat goes first
  const onHero = close.find((f) => f.t > c0 && Math.abs(f.surface!.box.w - hero.w) < 6 && Math.abs(f.surface!.box.h - hero.h) < 6)!;
  expect(onHero.t - c0).toBeGreaterThan(600);
  expect(onHero.t - c0).toBeLessThan(1500);
  const back = close.find((f) => f.t > c0 + 200 && f.topbar!.ty === 0 && f.right!.tx === 0 && f.bottom!.ty === 0 && f.fade!.o === 1)!;
  expect(back.t - c0).toBeGreaterThan(1000);
  expect(back.t - c0).toBeLessThan(2000);
  await closed(page);
  await expect(tab(page)).toBeFocused(); // the opener
});

test("the one globe sits behind the welcome at about 0.18, fades out once the conversation starts, and returns", async ({ page }) => {
  await ready(page);
  await expect(page.locator(PARTS.carrier)).toHaveCount(1);
  await expect(canvas(page), "the globe needs WebGL (SwiftShader here)").toHaveAttribute("data-globe", "running");
  await tab(page).click();
  await settled(page);
  await expect(page.locator(`.dash-assistant-globe ${PARTS.carrier}`)).toHaveCount(1); // carried, not copied
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => carrierOpacity(page)).toBeCloseTo(0.18, 2);
  await expect(canvas(page)).toHaveAttribute("data-globe", "running");
  await expect(canvas(page)).toHaveAttribute("data-globe-mode", "ambient");

  await composer(page).fill("Which runs wait on me?");
  await composer(page).press("Enter");
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText("Stub answer");
  await expect.poll(() => carrierOpacity(page)).toBe(0);
  await expect(canvas(page)).toHaveAttribute("data-globe", "paused"); // it stops drawing

  await page.getByRole("button", { name: /new (chat|conversation)/i }).click({ force: true });
  await expect.poll(() => carrierOpacity(page)).toBeCloseTo(0.18, 2);
  await expect(canvas(page)).toHaveAttribute("data-globe", "running");

  await minimize(page);
  await closed(page);
  await expect(page.locator(`.dash-globe-wrap ${PARTS.carrier}`)).toHaveCount(1); // home again
  await expect.poll(() => carrierOpacity(page)).toBe(1);
  await expect(canvas(page)).toHaveAttribute("data-globe-mode", "full");
});

test("opened from another view with a conversation, the globe stays home and doesn't draw", async ({ page }) => {
  await ready(page);
  await tab(page).click();
  await settled(page);
  await composer(page).fill("Which runs wait on me?");
  await composer(page).press("Enter");
  await expect(page.getByRole("log", { name: "Conversation" })).toContainText("Stub answer");
  await nav(page, "Findings").click();
  await closed(page);
  await tab(page).click(); // from Findings, with the conversation
  await settled(page);
  await expect(page.locator(`.dash-globe-wrap ${PARTS.carrier}`)).toHaveCount(1); // never came in
  await expect(canvas(page)).toHaveAttribute("data-globe", "paused");
  await page.waitForTimeout(700); // and it stays paused (the Overview under it is laid out, "visible")
  await expect(canvas(page)).toHaveAttribute("data-globe", "paused");
  await minimize(page);
  await closed(page);
  await expect(page.getByRole("heading", { name: "Findings", level: 1 })).toBeVisible();
});

test("leaving the dashboard with the assistant open leaves the next globe drawing at full quality", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => ((window as unknown as { kept: number }).kept = 7));
  await tab(page).click();
  await settled(page);
  await composer(page).fill("Which runs wait on me?");
  await composer(page).press("Enter");
  await expect(canvas(page)).toHaveAttribute("data-globe", "paused"); // faded behind the chat
  await page.locator('a[href="/docs"]').first().click();
  await expect(page).toHaveURL(/\/docs/);
  await page.locator('header a[href="/"]').first().click(); // back in the same page (no reload)
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(7);
  await expect(canvas(page)).toHaveAttribute("data-globe", "running");
  await expect(canvas(page)).toHaveAttribute("data-globe-mode", "full");
});

test("on a low-power device the globe behind the assistant is a still frame", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 }));
  await ready(page);
  await expect(canvas(page)).toHaveAttribute("data-globe", "running");
  await tab(page).click();
  await settled(page);
  await expect(canvas(page)).toHaveAttribute("data-globe-mode", "ambient");
  await expect(canvas(page)).toHaveAttribute("data-globe", "paused"); // not drawing behind it
  // …but it still shows: with everything else held still, the region looks different without it
  const globeShows = async () => {
    await expect.poll(() => carrierOpacity(page)).toBeCloseTo(0.18, 2); // its fade has ended
    const still = await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; }" });
    const box = (await page.locator(".dash-globe-carrier").boundingBox())!;
    const clip = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.25, width: box.width * 0.5, height: box.height * 0.5 };
    const shown = (await page.screenshot({ clip })).toString("base64");
    const tag = await page.addStyleTag({ content: ".dash-globe-canvas { visibility: hidden !important; }" });
    const hidden = (await page.screenshot({ clip })).toString("base64");
    await tag.evaluate((el) => (el as Element).remove());
    await still.evaluate((el) => (el as Element).remove());
    return page.evaluate(async ([a, b]) => {
      const pixels = async (png: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement("canvas");
        [c.width, c.height] = [img.width, img.height];
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [pa, pb] = [await pixels(a), await pixels(b)];
      let sum = 0;
      for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i + 1] - pb[i + 1]);
      return sum / (pa.length / 4); // the canvas's mean share of the green channel
    }, [shown, hidden]);
  };
  expect(await globeShows()).toBeGreaterThan(1); // ≈4 when drawn, ≈0.2 when cleared
  await minimize(page);
  await closed(page);
  await expect(canvas(page)).toHaveAttribute("data-globe", "running");
  await expect(canvas(page)).toHaveAttribute("data-globe-mode", "full");

  // a phone: the crossfade carries it in as the open lands, into a box of its own size, and the
  // resize that clears the canvas comes after it paused: it redraws the still frame
  await page.setViewportSize({ width: 390, height: 844 });
  await tab(page).click();
  await settled(page);
  await expect(canvas(page)).toHaveAttribute("data-globe", "paused");
  await expect.poll(globeShows).toBeGreaterThan(1);
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

  // eight clicks, the last one on the Overview: it ends closed, with nothing left behind
  for (let i = 0; i < 8; i++) {
    await (i % 2 ? nav(page, "Overview") : tab(page)).click();
    await page.waitForTimeout(60 + i * 35);
  }
  const state = () =>
    page.evaluate((parts) => {
      const inline = [parts.topbar, parts.right, parts.bottom, parts.fade].filter((s) => {
        const el = document.querySelector<HTMLElement>(s)!;
        return el.style.transform || el.style.opacity;
      });
      const carrier = document.querySelector<HTMLElement>(parts.carrier)!;
      return {
        view: new URLSearchParams(location.search).get("view"),
        on: document.querySelector(".dash-assistant-stage")!.hasAttribute("data-on"),
        breathing: document.querySelector(".dash-frame")!.hasAttribute("data-breathing"),
        backdrop: document.querySelector("[data-assistant-backdrop]") !== null,
        carriedIn: carrier.parentElement!.className,
        carrierOpacity: getComputedStyle(carrier).opacity,
        inline,
      };
    }, PARTS);
  await expect
    .poll(state, { timeout: 8000 })
    .toEqual({ view: null, on: false, breathing: false, backdrop: false, carriedIn: "dash-globe-wrap", carrierOpacity: "1", inline: [] });
  expect(await length()).toBeLessThanOrEqual(before + 1);
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
  await expect.poll(() => carrierOpacity(page)).toBeCloseTo(0.18, 2);
  await minimize(page);
  await closed(page);
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await expect(page.locator(`.dash-globe-wrap ${PARTS.carrier}`)).toHaveCount(1);
  await expect(page.locator(PARTS.right)).toHaveCSS("transform", "none");
});

test("a click on the Ask bar's background opens it, and focus comes back to the Ask bar's field", async ({ page }) => {
  await ready(page);
  await hideCanvas(page);
  await page.locator(".dash-askbar").click({ position: { x: 240, y: 72 } }); // not the field, not a button
  await settled(page);
  await expect(composer(page)).toBeFocused();
  await minimize(page);
  await closed(page);
  await expect(page.locator(".dash-askbar input")).toBeFocused();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("it crossfades instead of growing, and the composer stays in reach", async ({ page }) => {
    await ready(page);
    await hideCanvas(page);
    const recording = sample(page, 1200);
    await tab(page).click();
    const open = await recording;
    const stageWidth = open.at(-1)!.stage!.box.w;
    for (const f of open) expect(Math.abs(f.surface!.box.w - stageWidth)).toBeLessThan(1); // no grow
    const [fadeStart, fadeEnd] = moves(open, (f) => f.front!.o, 0.01);
    expect(fadeStart).toBeGreaterThanOrEqual(0);
    expect(fadeEnd - fadeStart).toBeLessThan(700);
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
    const recording = sample(page, 1000);
    await tab(page).click();
    const open = await recording;
    for (const f of open) {
      for (const part of ["topbar", "right", "bottom"] as const) expect([f[part]!.tx, f[part]!.ty]).toEqual([0, 0]);
      expect(f.surface!.box.w).toBe(open.at(-1)!.stage!.box.w);
    }
    const [fadeStart, fadeEnd] = moves(open, (f) => f.front!.o, 0.01);
    expect(fadeEnd - fadeStart).toBeLessThan(500);
    await settled(page);
    const loops = [".dash-ai-icon", ".dash-ai-halo", ".dash-assistant-panel", ".dash-assistant-card", ".dash-assistant-globe-breath"];
    for (const selector of loops) await expect(page.locator(selector).first()).toHaveCSS("animation-name", "none");
    await expect.poll(() => page.locator(".dash-ai-halo").evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.3);
    await minimize(page);
    await closed(page);
    await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  });
});
