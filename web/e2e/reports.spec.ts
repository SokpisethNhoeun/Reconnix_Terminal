/* Combining saved runs into one report, in the Report view's all-runs mode: pick runs (the
   sixth is disabled with a reason, Clear empties the selection, the selection survives a
   search), Preview report frames the combined HTML with every chosen run in it, Generate PDF
   downloads one real PDF, and the panel works at phone size. The 501 path (no browser to
   print with) is unit-tested in tests/combined-route.test.ts. */
import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

import { sample, signIn } from "./support";

const COMBINE_MAX = 5;
const pick = (page: Page) => page.getByRole("checkbox", { name: /^Combine / });
/** Tick the n-th run through its visible box (the input itself is 1px, for screen readers). */
const tick = (page: Page, n: number) => page.locator("label.rep-pick").nth(n).click();
const preview = (page: Page) => page.getByRole("button", { name: /^(Preview report|Loading preview…)$/ });
const generate = (page: Page) => page.getByRole("button", { name: /^(Generate PDF|Generating…)$/ });
const frame = (page: Page) => page.frameLocator('iframe[title="Combined report preview"]');

async function openReports(page: Page) {
  await signIn(page);
  await page.goto("/?view=reports");
  await expect(page.getByRole("heading", { name: "Combine runs" })).toBeVisible();
}

test("two runs preview as one combined report and generate one PDF", async ({ page }) => {
  test.setTimeout(120_000); // the PDF is printed by a headless browser on this machine
  await openReports(page);
  const all = sample();
  expect(all.length).toBeGreaterThanOrEqual(2);
  const count = page.getByText(new RegExp(`^\\d+ of ${COMBINE_MAX} selected$`));
  await expect(count).toHaveText(`0 of ${COMBINE_MAX} selected`);
  await expect(preview(page)).toBeDisabled();
  await expect(generate(page)).toBeDisabled();
  await expect(page.getByText("Pick at least one run.")).toBeVisible();

  // the two newest runs (the table is newest first)
  await tick(page, 0);
  await tick(page, 1);
  await expect(pick(page).nth(0)).toBeChecked();
  await expect(pick(page).nth(1)).toBeChecked();
  await expect(count).toHaveText(`2 of ${COMBINE_MAX} selected`);
  await expect(generate(page)).toBeDisabled();
  await expect(page.getByText("Preview the report first.")).toBeVisible();
  const chosen = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.uid.localeCompare(a.uid)).slice(0, 2);

  await preview(page).click();
  const previewCard = page.getByRole("region", { name: "Preview" });
  await expect(previewCard).toBeVisible();
  const doc = frame(page);
  await expect(doc.getByRole("heading", { name: "Combined security assessment report" })).toBeVisible({ timeout: 20_000 });
  for (const a of chosen) await expect(doc.locator("body")).toContainText(a.uid);
  await expect(doc.getByRole("heading", { name: "Executive summary" })).toBeVisible();
  await expect(doc.getByRole("heading", { name: "Risk & remediation priorities" })).toBeVisible();
  await expect(doc.locator("script")).toHaveCount(0);

  // the same HTML the PDF prints: what the frame shows is what the route serves
  const res = await page.request.get((await page.locator('iframe[title="Combined report preview"]').getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(await res.text()).toContain("Combined security assessment report");

  await expect(generate(page)).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), generate(page).click()]);
  expect(download.suggestedFilename()).toMatch(/^combined-2-runs-\d{4}-\d{2}-\d{2}\.pdf$/);
  const file = readFileSync((await download.path())!);
  expect(file.subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.getByRole("status").filter({ hasText: /^Downloaded combined-2-runs-/ })).toBeVisible();
  await expect(generate(page)).toHaveText("Generate PDF");

  // a changed option makes the preview stale: the PDF waits for a new preview
  await page.locator("label.ui-check", { hasText: "Include the appendix" }).click();
  await expect(page.getByRole("checkbox", { name: "Include the appendix" })).not.toBeChecked();
  await expect(generate(page)).toBeDisabled();
  await expect(page.getByText(/changed since this preview/)).toBeVisible();
});

test("the sixth run is disabled with a reason, and Clear empties the selection", async ({ page }) => {
  await openReports(page);
  const boxes = pick(page);
  const total = await boxes.count();
  test.skip(total <= COMBINE_MAX, `needs more than ${COMBINE_MAX} saved runs`);
  for (let i = 0; i < COMBINE_MAX; i += 1) await tick(page, i);
  await expect(page.getByText(`${COMBINE_MAX} of ${COMBINE_MAX} selected`)).toBeVisible();
  const sixth = boxes.nth(COMBINE_MAX);
  await expect(sixth).toBeDisabled();
  await expect(sixth).toHaveAccessibleDescription(`${COMBINE_MAX} already selected`);
  // unticking one frees the sixth
  await tick(page, 0);
  await expect(boxes.nth(0)).not.toBeChecked();
  await expect(sixth).toBeEnabled();
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByText(`0 of ${COMBINE_MAX} selected`)).toBeVisible();
  for (let i = 0; i < total; i += 1) await expect(boxes.nth(i)).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeDisabled();
});

test("the selection survives a search of the table, by keyboard", async ({ page }) => {
  await openReports(page);
  const all = sample();
  test.skip(all.length < 7, "the search field appears from seven runs");
  const first = pick(page).first();
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  const search = page.getByRole("searchbox", { name: "Search saved assessments" });
  await search.fill("no-such-run-zzz");
  await expect(page.getByText("No saved assessment matches.")).toBeVisible();
  await expect(page.getByText(`1 of ${COMBINE_MAX} selected`)).toBeVisible();
  await search.fill("");
  await expect(pick(page).first()).toBeChecked();
});

test.describe("at phone size", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the panel stacks and the preview scrolls inside its frame", async ({ page }) => {
    await openReports(page);
    await page.locator("label.rep-pick").first().tap(); // the visible box; the input itself is 1px
    await expect(pick(page).first()).toBeChecked();
    await preview(page).tap();
    const iframe = page.locator('iframe[title="Combined report preview"]');
    await expect(iframe).toBeVisible({ timeout: 20_000 });
    await expect(frame(page).getByRole("heading", { name: "Combined security assessment report" })).toBeVisible();
    const box = (await iframe.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
    expect(box.height).toBeGreaterThanOrEqual(320);
    expect(box.height).toBeLessThanOrEqual(600);
    // no sideways page scroll
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
