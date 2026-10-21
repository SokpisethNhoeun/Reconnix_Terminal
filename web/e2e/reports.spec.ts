/* Combining saved runs into one report, in the Report view's all-runs mode: pick runs (the
   sixth is disabled with a reason, Clear empties the selection, the selection survives a
   search), Preview report frames the combined HTML with every chosen run in it, Generate PDF
   downloads one real PDF, the failure paths (a 500 on the preview offers Retry, a 501 on the PDF
   offers the HTML), and the panel works at phone size. */
import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

import { combinedHref } from "../src/lib/report/combined/options";
import { hydrated, sample } from "./support";

const COMBINE_MAX = 5;
const pick = (page: Page) => page.getByRole("checkbox", { name: /^Combine / });
/** Tick the n-th run through its visible box (the input itself is 1px, for screen readers). */
const tick = (page: Page, n: number) => boxLabel(page).nth(n).click();
const boxLabel = (page: Page) => page.locator("label").filter({ has: page.getByRole("checkbox", { name: /^Combine / }) });
/** The run's own row (its report link names its uid), and its box's label. */
const tickRun = (page: Page, uid: string) =>
  page.locator("tr").filter({ has: page.locator(`a[href*="uid=${uid}"]`) }).locator("label").filter({ has: page.getByRole("checkbox", { name: /^Combine / }) }).click();
const preview = (page: Page) => page.getByRole("button", { name: /^(Preview report|Loading preview…)$/ });
const generate = (page: Page) => page.getByRole("button", { name: /^(Generate PDF|Generating…)$/ });
const frame = (page: Page) => page.frameLocator('iframe[title="Combined report preview"]');

async function openReports(page: Page) {
  await page.goto("/?view=reports");
  await expect(page.getByRole("heading", { name: "Combine runs" })).toBeVisible();
  await hydrated(page);
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

  // the same HTML the PDF prints: what the frame shows is what the route serves (fully sandboxed, no src)
  const iframe = page.locator('iframe[title="Combined report preview"]');
  await expect(iframe).toHaveAttribute("sandbox", "");
  expect(await iframe.getAttribute("src")).toBeNull();
  const res = await page.request.get(combinedHref(chosen.map((a) => a.uid).sort(), "html", { evidence: true, low: true, appendix: true }));
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  const served = await res.text();
  expect(served).toContain("Combined security assessment report");
  expect(await iframe.getAttribute("srcdoc")).toBe(served);

  await expect(generate(page)).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), generate(page).click()]);
  expect(download.suggestedFilename()).toMatch(/^combined-2-runs-\d{4}-\d{2}-\d{2}\.pdf$/);
  const file = readFileSync((await download.path())!);
  expect(file.subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.getByRole("status").filter({ hasText: /^Downloaded combined-2-runs-/ })).toBeVisible();
  await expect(generate(page)).toHaveText("Generate PDF");

  // a changed option makes the preview stale: the PDF waits for a new preview
  await page.locator("label").filter({ has: page.getByRole("checkbox", { name: "Include the appendix" }) }).click();
  await expect(page.getByRole("checkbox", { name: "Include the appendix" })).not.toBeChecked();
  await expect(generate(page)).toBeDisabled();
  await expect(page.getByText(/changed since this preview/)).toBeVisible();
});

test("a failed preview offers Retry, and a PDF without a printer offers the HTML", async ({ page }) => {
  await openReports(page);
  let previews = 0;
  await page.route("**/api/reports/combined?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("format") === "pdf") {
      await route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ detail: "No browser to print with (stub).", html: `/api/reports/combined?${url.searchParams}`.replace("format=pdf", "format=html") }) });
      return;
    }
    previews += 1;
    if (previews === 1) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "Stubbed failure." }) });
    else await route.continue();
  });
  await tick(page, 0);
  await preview(page).click();
  const alert = page.getByRole("alert").filter({ hasText: "The preview could not be loaded" });
  await expect(alert).toContainText("The preview could not be loaded: Stubbed failure.");
  await expect(generate(page)).toBeDisabled();
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(frame(page).getByRole("heading", { name: "Combined security assessment report" })).toBeVisible({ timeout: 20_000 });
  await expect(generate(page)).toBeEnabled();
  await generate(page).click();
  const status = page.locator(".rep-status");
  await expect(status).toContainText("No browser to print with (stub).");
  const html = status.getByRole("link", { name: "Download HTML" });
  await expect(html).toBeVisible();
  expect(await html.getAttribute("href")).toContain("format=html");
  await expect(generate(page)).toBeEnabled(); // not stuck on "Generating…"
});

test("the sixth run is disabled with a reason, and Clear empties the selection", async ({ page }) => {
  await openReports(page);
  const boxes = pick(page);
  const total = await boxes.count(); // the first page: ten runs
  expect(total, `the sample data needs more than ${COMBINE_MAX} runs on a page`).toBeGreaterThan(COMBINE_MAX);
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
  expect(sample().length, "the search field appears from seven runs").toBeGreaterThanOrEqual(7);
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

// the two runs that saw the same Broken object-level authorization on api.example.com
const SHARED = ["20260930-160500-8a01_RCX-DEMO-001", "20261003-101500-3ceb_RCX-DEMO-002"];
const STOPPED_EARLY = "20261001-083000-2265_RCX-DEMO-003"; // stopped before its scope was approved: no manifest
/** Click an option's visible label (its input is 1px, for screen readers) and expect it off. */
const turnOff = async (page: Page, name: string) => {
  const box = page.getByRole("checkbox", { name });
  await page.locator("label").filter({ has: box }).click();
  await expect(box).not.toBeChecked();
};

test("a finding two runs share counts once, with an occurrence in each run", async ({ page }) => {
  await openReports(page);
  for (const uid of SHARED) await tickRun(page, uid);
  await expect(page.getByText(`2 of ${COMBINE_MAX} selected`)).toBeVisible();
  await preview(page).click();
  const doc = frame(page);
  await expect(doc.getByRole("heading", { name: "Combined security assessment report" })).toBeVisible({ timeout: 20_000 });
  const text = await doc.locator("body").innerText();
  const [, unique, occurrences] = text.match(/Unique findings\s*(\d+) \((\d+) occurrences?\)/i)!.map(Number);
  expect(occurrences, "a shared finding is one unique finding with two occurrences").toBeGreaterThan(unique);
  // 3 + 4 findings recorded; the BOLA finding is in both
  expect(occurrences).toBe(7);
  expect(unique).toBe(6);
  await expect(doc.getByText("2 occurrences").first()).toBeVisible();
  await expect(doc.locator("pre.evidence").first()).toBeVisible();
  await expect(doc.getByText("No rate limiting on login").first()).toBeVisible(); // LOW is in by default
});

test("with evidence and LOW off the preview drops the evidence blocks and the LOW findings", async ({ page }) => {
  await openReports(page);
  for (const uid of SHARED) await tickRun(page, uid);
  await turnOff(page, "Include masked evidence");
  await turnOff(page, "Include LOW and INFO findings");
  await preview(page).click();
  const doc = frame(page);
  await expect(doc.getByRole("heading", { name: "Combined security assessment report" })).toBeVisible({ timeout: 20_000 });
  await expect(doc.locator("pre.evidence")).toHaveCount(0);
  await expect(doc.locator("#evidence").getByText("Evidence lines were left out by the report's options.")).toBeVisible();
  await expect(doc.getByText("Broken object-level authorization").first()).toBeVisible(); // MEDIUM stays
  await expect(doc.getByText("No rate limiting on login")).toHaveCount(0); // LOW: gone
  await expect(doc.getByText("HSTS header missing")).toHaveCount(0);
});

test("a run with no saved scope is listed under Limitations as not recorded", async ({ page }) => {
  await openReports(page);
  await tickRun(page, SHARED[0]);
  await page.getByRole("searchbox", { name: "Search saved assessments" }).fill("portal.example.net");
  await tickRun(page, STOPPED_EARLY);
  await preview(page).click();
  const doc = frame(page);
  await expect(doc.getByRole("heading", { name: "Limitations" })).toBeVisible({ timeout: 20_000 });
  await expect(doc.getByText("has no Scope Manifest saved: the boundary of its testing is not recorded.")).toBeVisible();
});

test("a PDF the server fails on (500) shows why, offers Retry, and the button leaves Generating", async ({ page }) => {
  await openReports(page);
  await page.route("**/api/reports/combined?*format=pdf*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "Stubbed print failure." }) }),
  );
  await tickRun(page, SHARED[0]);
  await preview(page).click();
  await expect(frame(page).getByRole("heading", { name: "Combined security assessment report" })).toBeVisible({ timeout: 20_000 });
  await generate(page).click();
  const status = page.locator("[data-pdf]");
  await expect(status).toHaveAttribute("data-pdf", "failed");
  await expect(status).toContainText("The PDF could not be generated");
  await expect(status.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(generate(page)).toHaveText("Generate PDF"); // not stuck on "Generating…"
  await expect(generate(page)).toBeEnabled();
});

test("a PDF request that is cut off shows the dashboard could not be reached", async ({ page }) => {
  await openReports(page);
  await page.route("**/api/reports/combined?*format=pdf*", (route) => route.abort("failed"));
  await tickRun(page, SHARED[0]);
  await preview(page).click();
  await expect(frame(page).getByRole("heading", { name: "Combined security assessment report" })).toBeVisible({ timeout: 20_000 });
  await generate(page).click();
  await expect(page.locator("[data-pdf]")).toHaveAttribute("data-pdf", "failed");
  await expect(page.locator("[data-pdf]")).toContainText("the dashboard could not be reached");
  await expect(generate(page)).toHaveText("Generate PDF");
});

test.describe("at phone size", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the panel stacks and the preview scrolls inside its frame", async ({ page }) => {
    await openReports(page);
    await boxLabel(page).first().tap(); // the visible box; the input itself is 1px
    await expect(pick(page).first()).toBeChecked();
    await preview(page).tap();
    const iframe = page.locator('iframe[title="Combined report preview"]');
    await expect(iframe).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".rep-preview-card")).toBeFocused(); // the preview takes focus when it appears
    await expect(frame(page).getByRole("heading", { name: "Combined security assessment report" })).toBeVisible();
    const box = (await iframe.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
    expect(box.height).toBeGreaterThanOrEqual(320);
    expect(box.height).toBeLessThanOrEqual(600);
    // no sideways page scroll
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
