/* Every page renders the sample data with the right numbers, in both themes. */
import { expect, test } from "@playwright/test";

import { sample, signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the overview counts what the files hold", async ({ page }) => {
  const data = sample();
  const findings = data.flatMap((a) => a.findings);
  const blocked = data.flatMap((a) => a.verdicts).filter((v) => !v.allowed).length;
  const tile = (label: string) => page.locator(".kpi").filter({ hasText: label }).locator("span").nth(1);

  await expect(tile("Assessments")).toHaveText(String(data.length));
  await expect(tile("Findings")).toHaveText(String(findings.length));
  await expect(tile("Blocked by policy")).toHaveText(String(blocked));
  for (const title of ["Findings by severity", "Findings per day", "Recent assessments", "Needs attention", "Top weakness categories", "Findings by template"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  const waiting = data.find((a) => a.status === "Awaiting input")!;
  await expect(page.getByText(`${waiting.label} waits for you`)).toBeVisible();
});

test("needs attention opens the runs that need it", async ({ page }) => {
  const runs = sample().filter((a) => ["Awaiting input", "Stopped", "Interrupted"].includes(a.status));
  const card = page.getByRole("region", { name: "Needs attention" });
  await card.getByRole("link", { name: `View all (${runs.length})` }).click();
  await expect(page).toHaveURL(/\/assessments\?status=attention$/);
  await expect(page.locator("tbody tr")).toHaveCount(runs.length);
});

test("the chart has a table view", async ({ page }) => {
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.locator("table").filter({ hasText: "Assessments" }).first()).toBeVisible();
});

test("assessments open into their sections", async ({ page }) => {
  const data = sample();
  await page.getByRole("link", { name: "Assessments" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(data.length);

  const done = data.find((a) => a.status === "Completed" && a.findings.length)!;
  await page.goto(`/assessments/${done.uid}`);
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();

  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByText("Scope approved.", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: "Policy", exact: true }).click();
  await expect(page.locator("ol.m-0 li").first()).toContainText("POLICY");

  await page.getByRole("link", { name: /^Findings \(/ }).click();
  await expect(page.getByRole("heading", { name: done.findings[0].title, level: 3 })).toBeVisible();

  await page.getByRole("link", { name: "Scope & policy" }).click();
  await expect(page.getByText("BLOCKED").first()).toBeVisible();

  await page.getByRole("link", { name: "Approvals", exact: true }).click();
  await expect(page.getByText("APPROVED").first()).toBeVisible();
});

test("a waiting assessment says to decide in the terminal", async ({ page }) => {
  const waiting = sample().find((a) => a.status === "Awaiting input")!;
  await page.goto(`/assessments/${waiting.uid}`);
  await expect(page.getByText("Waiting in the terminal app:")).toBeVisible();
});

test("findings filter by severity and search", async ({ page }) => {
  const findings = sample().flatMap((a) => a.findings);
  const onePage = (n: number) => Math.min(n, 10);
  await page.goto("/findings");
  await expect(page.locator("tbody tr")).toHaveCount(onePage(findings.length));
  await page.getByRole("link", { name: "High", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(onePage(findings.filter((f) => f.severity === "HIGH").length));
  await page.goto("/findings?q=cookie");
  await expect(page.locator("tbody tr")).toHaveCount(onePage(findings.filter((f) => f.title.toLowerCase().includes("cookie")).length) || 1);
});

test("findings page through 10 at a time", async ({ page }) => {
  const total = sample().flatMap((a) => a.findings).length;
  expect(total).toBeGreaterThan(10); // the sample data has a second page
  await page.goto("/findings");
  const pager = page.getByRole("navigation", { name: "Finding pages" });
  await expect(pager).toContainText(`1–10 of ${total}`);
  await expect(pager.getByRole("link", { name: "Previous page" })).toHaveAttribute("aria-disabled", "true");
  await pager.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(page.locator("tbody tr")).toHaveCount(Math.min(total - 10, 10));
  await expect(pager).toContainText(`11–${Math.min(total, 20)} of ${total}`);
  // choosing a finding keeps the page; a filter goes back to page 1
  await page.locator("tbody tr a").first().click();
  await expect(page).toHaveURL(/page=2.*f=|f=.*page=2/);
  await page.getByRole("link", { name: "Confirmed", exact: true }).click();
  await expect(page).not.toHaveURL(/page=/);
});

test("policy shows blocked requests and decisions", async ({ page }) => {
  await page.goto("/policy");
  await expect(page.getByRole("heading", { name: "Blocked requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approval decisions" })).toBeVisible();
  await expect(page.getByText("REJECTED").first()).toBeVisible();
});

test("approval decisions page on their own", async ({ page }) => {
  const total = sample().reduce((n, a) => n + a.approvals.length, 0);
  expect(total).toBeGreaterThan(10);
  await page.goto("/policy");
  const decisions = page.getByRole("region", { name: "Approval decisions" });
  await expect(decisions.locator("tbody tr")).toHaveCount(10);
  await decisions.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/[?&]decisions=2/);
  await expect(decisions.locator("tbody tr")).toHaveCount(Math.min(total - 10, 10));
  // the blocked requests stay where they were (one page in the sample data)
  await expect(page.getByRole("navigation", { name: "Blocked request pages" })).toHaveCount(0);
});

test("the theme toggle switches to dark and back", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await page.getByRole("button", { name: "Switch to the dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to the light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the about page explains the project", async ({ page }) => {
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: "About Reconix", level: 1 })).toBeVisible();
  for (const title of ["How an assessment runs", "Safety gates", "How the pieces fit", "Code map and commands", "Words you'll see"]) {
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  }
  await expect(page.getByRole("list", { name: "Assessment steps" }).getByRole("listitem")).toHaveCount(8);
  // "Where to look" links to the pages this operator can open, the Terminal included
  await expect(page.getByRole("region", { name: "Where to look in this dashboard" }).getByRole("link")).toHaveCount(5);
});

test("an unknown assessment is a 404 page", async ({ page }) => {
  const res = await page.goto("/assessments/20260101-000000-ffff_RCX-NOPE-001");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Not found")).toBeVisible();
});
