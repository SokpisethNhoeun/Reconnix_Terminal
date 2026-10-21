/* Scrolling and the responsive frame (docs/WEB_REDESIGN_V2_PLAN.md §6). The dashboard scrolls
   natively at every size: on the fixed desktop frame (≥1280×760) its content area is the one
   scroller, elsewhere the window is. Real wheel, keyboard and touch input move it; nothing
   overflows sideways or hangs out of reach; the docs still glide with Lenis; and the assistant's
   conversation scrolls on its own with the composer in view. The wheel tests run with motion on,
   because the old bug (Lenis taking the wheel on the dashboard) only existed with motion on.
   The long view they scroll is the every-run Report: on the fixed frame the Findings view
   scrolls its list pane, not the content area (e2e/findings.spec.ts). */
import { type CDPSession, type Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import { clickMoving, frames, newest, signIn } from "./support";

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 }, // a tablet held upright
  { width: 844, height: 390 }, // a phone held sideways: wide enough for the rail, too short for it to stick
  { width: 390, height: 844 },
];
const label = (s: { width: number; height: number }) => `${s.width}×${s.height}`;
const fixedFrame = (s: { width: number; height: number }) => s.width >= 1280 && s.height >= 760;
const RUN = newest().uid; // Reports and Scope for one run, as well as for every run
const VIEWS = ["overview", "findings", "assessments", "reports", "scope", `reports&uid=${RUN}`, `scope&uid=${RUN}`];
const viewName = (v: string) => (v.includes("&uid=") ? `${v.split("&")[0]} (one run)` : v);

// the wheel and touch tests run with motion on (the project's default is reduced, for speed)
test.use({ reducedMotion: "no-preference" });

/* Known faults by size and view (none today): the check for that pair is expected to FAIL, and
   fails with "remove this entry" once the fault is gone, so a stale entry can't hide a new one. */
const KNOWN_OVERHANG = new Set<string>([]);
const KNOWN_SIDEWAYS = new Set<string>([]);

type Scroll = { kind: "content" | "window"; top: number; range: number };

/** Whatever scrolls the open view: the content area (<main>) on the fixed frame, else the window. */
function scrollState(page: Page): Promise<Scroll> {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const y = getComputedStyle(main).overflowY;
    if (y === "auto" || y === "scroll") return { kind: "content", top: main.scrollTop, range: main.scrollHeight - main.clientHeight };
    const root = document.scrollingElement!;
    return { kind: "window", top: root.scrollTop, range: root.scrollHeight - root.clientHeight };
  });
}

/** Wait until the open view stops changing size (the intro animates cards in). */
async function settled(page: Page) {
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await scrollState(page));
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [300] })
    .toBe(true);
}

async function open(page: Page, view: string) {
  await page.goto(`/?view=${view}`);
  await expect(page.locator("main > :not([hidden])").first()).toBeVisible();
  await settled(page);
}

/** Real wheel input over the open view, sent until its end is reached (or the time runs out:
    then the poll fails with how far from the end it got); returns where it ended. */
async function wheelToEnd(page: Page, x: number, y: number, timeout = 15_000) {
  await page.mouse.move(x, y);
  await expect
    .poll(
      async () => {
        const s = await scrollState(page);
        if (s.range - s.top > 1) await page.mouse.wheel(0, 800);
        return s.range - s.top;
      },
      { timeout, intervals: [150], message: "the wheel did not reach the end of the view" },
    )
    .toBeLessThanOrEqual(1);
  return scrollState(page);
}

/** How far the lowest visible piece of the open view (text, a control, or a box with a border or
    a fill, such as a card) hangs below what can be seen, with the view scrolled to its end
    (≤ 0: everything is reachable). Things inside an inner box that scrolls or clips are that
    box's business and are skipped, and so are decorations (aria-hidden, the globe's canvas). */
async function overhang(page: Page) {
  await page.evaluate(() => {
    const main = document.querySelector("main")!;
    main.scrollTop = main.scrollHeight;
    window.scrollTo(0, document.scrollingElement!.scrollHeight);
  });
  await frames(page, 3); // layout and the scroll position have settled
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const frame = main.closest<HTMLElement>(".dash-frame")!;
    const fr = frame.getBoundingClientRect();
    const floor = Math.min(main.getBoundingClientRect().bottom, fr.bottom - parseFloat(getComputedStyle(frame).borderBottomWidth), innerHeight);
    const view = main.querySelector(":scope > :not([hidden])");
    let worst = { by: -Infinity, what: "" };
    const inInnerBox = (el: Element) => {
      for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
        if (getComputedStyle(p).overflowY !== "visible") return true;
      }
      return false;
    };
    for (const el of view ? Array.from(view.querySelectorAll<HTMLElement>("*")) : []) {
      if (el.closest('[aria-hidden="true"]') || el.tagName === "CANVAS") continue;
      const s = getComputedStyle(el);
      const text = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      const surface = parseFloat(s.borderBottomWidth) > 0 || s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.backgroundImage !== "none";
      if (!text && !surface && !el.matches("a, button, input, textarea, select, [tabindex]")) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (!r.height || inInnerBox(el)) continue;
      if (r.bottom - floor > worst.by) worst = { by: Math.round(r.bottom - floor), what: `${el.tagName}.${el.classList[0] ?? ""} "${el.textContent!.trim().slice(0, 40)}"` };
    }
    return worst;
  });
}

/** Sidebar links that can't be brought fully on screen (scrolled into view as far as the page
    and the rail allow), or that the frame or the rail cuts off. */
function unreachableRail(page: Page) {
  return page.evaluate(() => {
    const rail = document.querySelector("aside")!;
    const missed: string[] = [];
    for (const el of Array.from(rail.querySelectorAll<HTMLElement>("a[href], button"))) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const r = el.getBoundingClientRect();
      const box = rail.getBoundingClientRect();
      const frame = rail.closest(".dash-frame")!.getBoundingClientRect();
      const inside = (outer: DOMRect) => r.top >= outer.top - 0.5 && r.bottom <= outer.bottom + 0.5 && r.left >= outer.left - 0.5 && r.right <= outer.right + 0.5;
      const onScreen = r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5;
      // the rail itself only clips sideways (the phone strip scrolls); the frame clips everything
      const railClips = getComputedStyle(rail).overflowX !== "visible";
      if (!onScreen || !inside(frame) || (railClips && !inside(box))) missed.push(el.getAttribute("aria-label") ?? el.textContent!.trim());
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    return missed;
  });
}

function sideways(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement!;
    const main = document.querySelector("main")!;
    return { page: root.scrollWidth - root.clientWidth, content: main.scrollWidth - main.clientWidth };
  });
}

/** A one-finger swipe upwards (content moves up), as touch events. */
async function swipeUp(page: Page, cdp: CDPSession, x: number, from: number, to: number) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: from + ((to - from) * i) / 12 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

// ---- the wheel (the owner's bug) ------------------------------------------------------------

for (const size of [SIZES[0], SIZES[2]]) {
  test.describe(`the owner's sizes, ${label(size)}`, () => {
    test.use({ viewport: size });

    for (const view of ["overview", "reports"]) {
      test(`the wheel scrolls the ${view} view to its end, in the content area`, async ({ page }) => {
        await signIn(page);
        await open(page, view);
        const start = await scrollState(page);
        expect(start.kind).toBe("content"); // the fixed frame: the content area scrolls, not the page
        if (view !== "overview") expect(start.range).toBeGreaterThan(200); // the sample's findings and runs don't fit
        await wheelToEnd(page, size.width * 0.6, size.height * 0.6);
        expect(await page.evaluate(() => scrollY)).toBe(0);
        expect(await page.evaluate(() => document.documentElement.classList.contains("lenis"))).toBe(false);
      });
    }
  });
}

// ---- every size: reachable, nothing sideways, the right scroller ----------------------------

for (const size of SIZES) {
  test.describe(`at ${label(size)}`, () => {
    test.use({ viewport: size, reducedMotion: "reduce" });

    test("every view reaches its bottom, nothing overflows sideways, the composer is in view", async ({ page }) => {
      test.setTimeout(120_000); // eight views, the assistant and a docs page, three browsers at a time
      await signIn(page);
      for (const view of VIEWS) {
        await open(page, view);
        const s = await scrollState(page);
        expect(s.kind, `${viewName(view)} scrolls the ${fixedFrame(size) ? "content area" : "window"}`).toBe(fixedFrame(size) ? "content" : "window");
        const key = `${label(size)} ${viewName(view)}`;
        const low = await overhang(page);
        if (KNOWN_OVERHANG.has(key)) expect(low.by, `${key} reaches its bottom now: remove this entry from KNOWN_OVERHANG`).toBeGreaterThanOrEqual(1);
        else expect(low.by, `${viewName(view)}: ${low.what} hangs out of reach`).toBeLessThanOrEqual(1);
        const wide = await sideways(page);
        expect(wide.page, `${viewName(view)}: the page scrolls sideways`).toBe(0);
        // the content area clips sideways, so anything wider than it would be cut off unseen
        if (KNOWN_SIDEWAYS.has(key)) expect(wide.content, `${key} fits sideways now: remove this entry from KNOWN_SIDEWAYS`).toBeGreaterThan(0);
        else expect(wide.content, `${viewName(view)}: content is cut off at the side`).toBe(0);
      }
      expect(await unreachableRail(page), "sidebar links out of reach").toEqual([]);
      // the page itself never hides its overflow to "fix" scrolling
      const hidden = await page.evaluate(() => [document.documentElement, document.body].map((el) => getComputedStyle(el).overflowY));
      expect(hidden).not.toContain("hidden");

      // the assistant: the composer is on screen without scrolling the page
      await page.goto("/?view=assistant");
      const composer = page.getByRole("textbox", { name: /^Ask about/ }).last();
      await expect(composer).toBeVisible();
      const b = (await composer.boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, "the composer is below the fold").toBeLessThanOrEqual(size.height);
      expect((await sideways(page)).page).toBe(0);

      // a docs page: the window scrolls to its foot and nothing hangs out sideways
      await page.goto("/docs/commands/import");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
      await expect
        .poll(() => page.evaluate(() => Math.round(document.scrollingElement!.scrollHeight - scrollY - innerHeight)), { message: "the docs page reaches its foot" })
        .toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth), "the docs page scrolls sideways").toBeLessThanOrEqual(0);
    });
  });

  test.describe(`the wheel at ${label(size)}, motion on`, () => {
    test.use({ viewport: size });

    test("scrolls the reports view to its end", async ({ page }) => {
      await signIn(page);
      await open(page, "reports");
      const end = await wheelToEnd(page, size.width * 0.6, size.height * 0.7);
      expect(end.kind).toBe(fixedFrame(size) ? "content" : "window");
      expect(end.range).toBeGreaterThan(0);
    });
  });
}

// ---- keyboard, touch, the sidebar on a long page --------------------------------------------

test.describe("on the fixed frame (1366×768)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("PageDown, Space, the arrows, End and Home scroll the content once it has focus", async ({ page }) => {
    await signIn(page);
    await open(page, "scope"); // every run's Scope: about a screen of range here, so each key is tried from the top
    await page.getByRole("heading", { name: "Scope", level: 1 }).click(); // focus lands in the content
    const top = async () => (await scrollState(page)).top;
    for (const [key, least] of [["PageDown", 200], ["Space", 200], ["ArrowDown", 1]] as const) {
      await page.keyboard.press(key);
      await expect.poll(top, { message: `${key} scrolls the content` }).toBeGreaterThanOrEqual(least);
      await page.keyboard.press("Home");
      await expect.poll(top).toBe(0);
    }
    await page.keyboard.press("End");
    await expect.poll(async () => { const s = await scrollState(page); return s.range - s.top; }).toBeLessThanOrEqual(1);
    await page.keyboard.press("Home");
    await expect.poll(top).toBe(0);
  });
});

for (const size of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test.describe(`touch at ${label(size)}`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: size.width < 768 });

    test("a swipe scrolls the reports view", async ({ page, context }) => {
      await signIn(page);
      await open(page, "reports");
      const cdp = await context.newCDPSession(page);
      await swipeUp(page, cdp, size.width * 0.6, size.height * 0.8, size.height * 0.3);
      await expect.poll(async () => (await scrollState(page)).top).toBeGreaterThan(100);
    });
  });
}

test.describe("on a tablet (1024×768) the page scrolls", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("and the sidebar stays in reach at the bottom of a long view", async ({ page }) => {
    await signIn(page);
    await open(page, "findings");
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
    const overview = page.locator('nav[aria-label="Views"] button[aria-label="Overview"]');
    const box = await overview.boundingBox();
    expect(box && box.y >= 0 && box.y + box.height <= 768).toBe(true);
    await overview.click();
    await expect(overview).toHaveAttribute("aria-current", "page");
  });
});

// ---- the docs keep Lenis; leaving them leaves it behind --------------------------------------

test.describe("the docs", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("glide with the wheel, follow their own hash links, and hand back a natively scrolling dashboard", async ({ page }) => {
    await page.goto("/docs/architecture");
    await expect(page.locator("html.lenis")).toHaveCount(1);
    await page.mouse.move(720, 500);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);

    await page.evaluate(() => window.scrollTo(0, 0));
    const toc = page.getByRole("navigation", { name: "On this page" }).getByRole("link");
    const target = toc.nth(2);
    const hash = (await target.getAttribute("href"))!;
    await target.click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    // the heading glides to just under the sticky nav (64px and its border), at its scroll-margin-top
    await expect.poll(() => page.locator(hash).evaluate((el) => Math.round(el.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(140);
    expect(await page.locator(hash).evaluate((el) => el.getBoundingClientRect().top), "the heading is under the nav").toBeGreaterThanOrEqual(65);

    await page.getByRole("banner").getByRole("link").first().click(); // the nav's logo: back to the dashboard
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.locator("html.lenis")).toHaveCount(0);
    await page.locator('nav[aria-label="Views"] button[aria-label="Reports"]').click();
    await settled(page);
    const end = await wheelToEnd(page, 900, 600);
    expect(end.range).toBeGreaterThan(0);
  });
});

// ---- the assistant: its own scroller, the composer in view ----------------------------------

/** A question tall enough to need scrolling; the stand-in model echoes it in its answer. */
const tall = (n: number) => `Q${n}: ` + Array.from({ length: 30 }, (_, i) => `line ${i} of a long question about findings and scope`).join("\n");

async function ask(page: Page, n: number) {
  const composer = page.getByRole("textbox", { name: /^Ask about/ }).last();
  await composer.fill(tall(n));
  // Enter is ignored while the previous reply is still closing: press until it is taken
  await expect(async () => {
    if (await composer.inputValue()) await composer.press("Enter");
    expect(await composer.inputValue()).toBe("");
  }).toPass({ timeout: 15_000 });
  const log = page.getByRole("log", { name: "Conversation" });
  // the question, then the answer that repeats it
  await expect.poll(async () => ((await log.innerText()).match(new RegExp(`Q${n}: line 0`, "g")) ?? []).length, { timeout: 15_000 }).toBe(2);
  await expect(log).not.toHaveAttribute("aria-busy", "true");
}

const logState = (page: Page) =>
  page.getByRole("log", { name: "Conversation" }).evaluate((el) => ({ top: el.scrollTop, range: el.scrollHeight - el.clientHeight }));

for (const size of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test.describe(`the assistant at ${label(size)}`, () => {
    test.use({ viewport: size, reducedMotion: "reduce" });

    test("the conversation scrolls with the wheel, keeps a reader who scrolled up, and the composer stays in view", async ({ page }) => {
      await page.goto("/?view=assistant");
      const composer = page.getByRole("textbox", { name: /^Ask about/ }).last();
      await expect(composer).toBeVisible();
      await ask(page, 1);
      await ask(page, 2);

      const log = page.getByRole("log", { name: "Conversation" });
      await expect.poll(async () => (await logState(page)).range).toBeGreaterThan(400);

      // (following new answers on its own is the "way back down" test below and the unit tests)
      const box = (await log.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 5000);
      await expect.poll(async () => { const s = await logState(page); return s.range - s.top; }).toBeLessThanOrEqual(1);

      const inView = async () => {
        const b = (await composer.boundingBox())!;
        return b.y >= 0 && b.y + b.height <= size.height;
      };
      expect(await inView()).toBe(true);
      expect(await page.evaluate(() => scrollY)).toBe(0); // the page itself did not have to move

      await page.mouse.wheel(0, -600);
      await expect.poll(async () => { const s = await logState(page); return s.range - s.top; }).toBeGreaterThan(300);
      const reading = (await logState(page)).top;

      // more arrives while the reader is up the page: they stay where they are
      await log.evaluate((el) => {
        const more = document.createElement("p");
        more.style.height = "400px";
        more.textContent = "more content";
        el.appendChild(more);
      });
      await frames(page, 4); // the new content is laid out and the stick-to-bottom has had its say
      expect(Math.abs((await logState(page)).top - reading)).toBeLessThanOrEqual(1);

      await page.mouse.wheel(0, 5000);
      await expect.poll(async () => { const s = await logState(page); return s.range - s.top; }).toBeLessThanOrEqual(1);
      expect(await inView()).toBe(true);
      expect(await sideways(page)).toMatchObject({ page: 0 });
    });
  });
}

/* The conversation's way back down: useStickToBottom with the assistant's view. */
test.describe("the assistant's way back down", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("New messages appears after scrolling up, follows nothing until clicked, then glides back and follows again", async ({ page }) => {
    await page.goto("/?view=assistant");
    await ask(page, 1);
    await ask(page, 2);
    const log = page.getByRole("log", { name: "Conversation" });
    const box = (await log.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -600);
    const back = page.getByRole("button", { name: "New messages" });
    await expect(back).toBeVisible();
    await clickMoving(page, back); // the panel breathes, so it is never "stable"
    await expect.poll(async () => { const s = await logState(page); return s.range - s.top; }).toBeLessThanOrEqual(1);
    await expect(back).toBeHidden();
    await log.evaluate((el) => {
      const more = document.createElement("p");
      more.style.height = "400px";
      el.appendChild(more);
    });
    await expect.poll(async () => { const s = await logState(page); return s.range - s.top; }).toBeLessThanOrEqual(1); // followed
  });
});
