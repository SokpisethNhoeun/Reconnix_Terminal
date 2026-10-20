/* The Overview fits the fixed desktop frame (docs/WEB_REDESIGN_V3_PLAN.md, workstream E1): at the
   standard desktop sizes from the smallest fixed frame (1280×760) up, the content area has nothing
   to scroll and every card sits whole inside the viewport, for every run and for one run. Sizes
   below 1280×760 are not the fixed frame (the window scrolls by design: scroll.spec.ts).
   Motion is reduced so the intro's enter transforms (cards slide up 24 px) don't count as
   overflow while they play; the layout they land on is what is measured. */
import { expect, type Page, test } from "@playwright/test";

import { newest, signIn } from "./support";

const SIZES = [
  { width: 1280, height: 760 }, // the smallest fixed frame
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const label = (s: { width: number; height: number }) => `${s.width}×${s.height}`;
const MODES = [
  { name: "every run", view: "overview" },
  { name: "one run", view: `overview&uid=${newest().uid}` },
];

/** The content area's hidden height (0 when nothing scrolls) and the cards outside the viewport. */
function fit(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const outside = Array.from(document.querySelectorAll<HTMLElement>(".dash-overview .dash-card"))
      .map((card) => ({ card, box: card.getBoundingClientRect() }))
      .filter(({ box }) => box.top < -0.5 || box.bottom > innerHeight + 0.5 || box.left < -0.5 || box.right > innerWidth + 0.5)
      .map(({ card, box }) => `${card.getAttribute("aria-label") ?? card.querySelector("h2")?.textContent} (${Math.round(box.top)}–${Math.round(box.bottom)})`);
    return { scroller: getComputedStyle(main).overflowY, overflow: main.scrollHeight - main.clientHeight, outside };
  });
}

/** Wait until the open view stops changing (the intro, fonts and the globe settle). */
async function settled(page: Page) {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await fit(page));
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [300] },
    )
    .toBe(true);
}

for (const size of SIZES) {
  test.describe(`at ${label(size)}`, () => {
    test.use({ viewport: size, reducedMotion: "reduce" });

    for (const mode of MODES) {
      test(`the Overview for ${mode.name} fits the content area, every card inside the viewport`, async ({ page }) => {
        await signIn(page);
        await page.goto(`/?view=${mode.view}`);
        await expect(page.locator(".dash-overview")).toBeVisible();
        await settled(page);
        const state = await fit(page);
        expect(state.scroller, "the fixed frame: the content area is the scroller").toBe("auto");
        expect(state.overflow, `${mode.name} at ${label(size)}: the content area scrolls`).toBe(0);
        expect(state.outside, `${mode.name} at ${label(size)}: cards outside the viewport`).toEqual([]);
      });
    }
  });
}
