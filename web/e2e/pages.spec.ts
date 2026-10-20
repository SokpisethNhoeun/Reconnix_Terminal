/* The globe dashboard on the sample data: every view, the assessment switcher, the report
   downloads, the docs, and the Terminal view (with the stand-in program from
   playwright.config.ts instead of the TUI). */
import { expect, type Page, test } from "@playwright/test";

import { counted, newest, sample, signIn } from "./support";

const view = (name: string) => `nav[aria-label="Views"] button[aria-label^="${name}"]`;

const stat = (page: Page, label: string) => page.locator(".dash-bottom .dash-card", { hasText: label }).locator("[data-countup]");

test("the overview totals every saved file by default", async ({ page }) => {
  await signIn(page);
  const all = sample();
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose an assessment" })).toContainText(`All (${all.length})`);
  await expect(stat(page, "Assessments")).toHaveText(String(all.length));
  await expect(stat(page, "Findings")).toHaveText(String(all.reduce((n, a) => n + counted(a).length, 0)));
  await expect(stat(page, "Policy checks")).toHaveText(String(all.reduce((n, a) => n + a.verdicts.length, 0)));
  await page.click(view("Findings"));
  await expect(page.locator('[role="option"]')).toHaveCount(all.reduce((n, a) => n + a.findings.length, 0));
  await page.click(view("Reports"));
  await expect(page.getByRole("list", { name: "Saved assessments" }).getByRole("link")).toHaveCount(all.length);
});

test("one run's overview counts what its file holds", async ({ page }) => {
  await signIn(page);
  const a = newest();
  await page.goto(`/?uid=${a.uid}`);
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await expect(stat(page, "Findings")).toHaveText(String(counted(a).length));
  await expect(stat(page, "Policy checks")).toHaveText(String(a.verdicts.length));
  await expect(stat(page, "Blocked by policy")).toHaveText(String(a.verdicts.filter((v) => !v.allowed).length));
  await expect(page.getByRole("button", { name: "Choose an assessment" })).toContainText(a.label);
});

test("the views switch in the page and keep their place in the address", async ({ page }) => {
  await signIn(page);
  for (const [name, param] of [["Findings", "findings"], ["Reports", "reports"], ["Scope", "scope"]]) {
    await page.click(view(name));
    await expect(page).toHaveURL(new RegExp(`view=${param}`));
    await expect(page.locator(view(name))).toHaveAttribute("data-active", "true");
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Scope", level: 1 })).toBeVisible();
});

test("the switcher opens another assessment and keeps the view", async ({ page }) => {
  await signIn(page);
  await page.click(view("Findings"));
  const other = sample().find((a) => a.uid !== newest().uid && counted(a).length > 1)!;
  await page.getByRole("button", { name: "Choose an assessment" }).click();
  await page.locator(`[role="dialog"] a[href*="uid=${other.uid}"]`).click();
  await expect(page).toHaveURL(new RegExp(`uid=${other.uid}`));
  await expect(page).toHaveURL(/view=findings/);
  await expect(page.locator('[role="option"]')).toHaveCount(other.findings.length);
});

test("a waiting run shows its pending approval", async ({ page }) => {
  await signIn(page);
  const waiting = sample().find((a) => a.status === "Awaiting input")!;
  await page.goto(`/?uid=${waiting.uid}`);
  await page.getByRole("button", { name: /waiting on you/ }).click();
  await expect(page.getByText("This run waits on you")).toBeVisible();
  await expect(page.getByText(/awaiting approval/).first()).toBeVisible();
  await page.click(view("Scope"));
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
});

test("the report links every export format and a download works", async ({ page }) => {
  await signIn(page);
  await page.goto(`/?uid=${newest().uid}`);
  await page.click(view("Reports"));
  const links = page.getByRole("navigation", { name: "Download the report" }).getByRole("link");
  await expect(links).toHaveText(["PDF", "HTML", "JSON", "CSV", "SARIF"]);
  const res = await page.request.get((await links.nth(2).getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect((await res.json()).uid ?? (await res.text())).toBeTruthy();
});

test("a card opens its documentation", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Open Findings by Severity documentation" }).click();
  await expect(page).toHaveURL(/\/docs\/reference\/findings/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("the terminal view runs a session and keeps it while you browse", async ({ page }) => {
  await signIn(page);
  await page.click(view("Terminal"));
  await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".xterm-rows")).toContainText("READY");
  await page.locator(".xterm").click();
  await page.keyboard.type("hello-reconix");
  await expect(page.locator(".xterm-rows")).toContainText("hello-reconix");
  await page.click(view("Overview"));
  await page.click(view("Terminal"));
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.locator(".xterm-rows")).toContainText("hello-reconix"); // the same session
});

test("the removed Audit log address opens the Overview", async ({ page }) => {
  await signIn(page);
  await page.goto("/?view=audit");
  await expect(page.getByRole("heading", { name: "Assessment Operations Center" })).toBeVisible();
  await expect(page.locator('nav[aria-label="Views"] button[aria-label="Audit log"]')).toHaveCount(0);
});

test("an unknown assessment opens every run, and an unknown page is a 404", async ({ page }) => {
  await signIn(page);
  await page.goto("/?uid=20200101-000000-dead_NOPE-1");
  await expect(page.getByRole("button", { name: "Choose an assessment" })).toContainText(`All (${sample().length})`);
  const res = await page.goto("/no-such-page");
  expect(res!.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Open the dashboard" })).toBeVisible();
});

test("findings filter by severity, validation and search, and clear in one click", async ({ page }) => {
  await signIn(page);
  const a = sample().find((x) => x.findings.length >= 3)!;
  await page.goto(`/?uid=${a.uid}&view=findings`);
  const rows = page.locator('[role="option"]');
  await expect(rows).toHaveCount(a.findings.length);
  const sev = a.findings[0].severity;
  await page.getByRole("group", { name: "Severity" }).getByRole("button", { name: new RegExp(`^${sev.toLowerCase()}`) }).click();
  await expect(page).toHaveURL(new RegExp(`sev=${sev}`));
  await expect(rows).toHaveCount(a.findings.filter((f) => f.severity === sev).length);
  await page.getByRole("searchbox", { name: "Search findings" }).fill("no-such-finding-zzz");
  await expect(page.getByText("No finding matches these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(a.findings.length);
  await page.getByRole("group", { name: "Validation" }).getByRole("button", { name: /^Confirmed/ }).click();
  await expect(rows).toHaveCount(a.findings.filter((f) => f.validation === "CONFIRMED" && f.status !== "false-positive").length);
});

test("the overview drills into filtered views", async ({ page }) => {
  await signIn(page);
  const a = sample().find((x) => x.findings.some((f) => f.severity === "MEDIUM") && x.verdicts.some((v) => !v.allowed))!;
  await page.goto(`/?uid=${a.uid}`);
  const medium = a.findings.filter((f) => f.severity === "MEDIUM").length;
  await page.getByRole("button", { name: `Show the ${medium} medium ${medium === 1 ? "finding" : "findings"}` }).click();
  await expect(page).toHaveURL(/view=findings/);
  await expect(page).toHaveURL(/sev=MEDIUM/);
  await expect(page.locator('[role="option"]')).toHaveCount(medium);

});

test("the switcher searches every saved run, and the bell lists other waiting runs", async ({ page }) => {
  await signIn(page);
  const waiting = sample().find((x) => x.status === "Awaiting input")!;
  const other = sample().find((x) => x.uid !== waiting.uid)!;
  await page.goto(`/?uid=${other.uid}`);
  await page.getByRole("button", { name: /waiting on you/ }).click();
  await expect(page.getByText(/other run waits on a decision|other runs wait on a decision/)).toBeVisible();
  await page.locator(`a[href*="uid=${waiting.uid}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`uid=${waiting.uid}`));

  await page.getByRole("button", { name: "Choose an assessment" }).click();
  const list = page.locator('[role="dialog"] li a');
  await expect(list).toHaveCount(sample().length + 1); // "All assessments", then every run
});
