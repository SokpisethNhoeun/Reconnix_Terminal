/* Every page renders the sample data with the right numbers, in both themes. */
import { expect, test } from "@playwright/test";

import { sample, signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the dashboard counts what the files hold", async ({ page }) => {
  const data = sample();
  const vulns = data.flatMap((a) => a.findings).filter((f) => f.status !== "false-positive");
  const blocked = data.flatMap((a) => a.verdicts).filter((v) => !v.allowed).length;
  const tile = (label: string) => page.locator(".kpi").filter({ hasText: label }).locator(".kpi-value");

  await expect(tile("Assessments")).toHaveText(String(data.length));
  await expect(tile("Findings")).toHaveText(String(vulns.length));
  await expect(tile("Blocked by policy")).toHaveText(String(blocked));
  await expect(page.locator(".kpi").filter({ hasText: "Critical & High" })).toBeVisible();
  for (const title of ["Needs attention", "Findings by severity", "Findings per day", "Recent assessments"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("needs attention lists decisions and findings to review", async ({ page }) => {
  const waiting = sample().find((a) => a.status === "Awaiting input");
  const card = page.getByRole("region", { name: "Needs attention" });
  if (waiting) await expect(card.getByText(`${waiting.label} needs your decision`)).toBeVisible();
  // every row carries a button into the place that acts on it
  await expect(card.getByRole("link", { name: /Continue in AI|View/ }).first()).toBeVisible();
});

test("the chart has a table view", async ({ page }) => {
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.locator("table").filter({ hasText: "Assessments" }).first()).toBeVisible();
});

test("assessments open into their sections", async ({ page }) => {
  const data = sample();
  // scope to the sidebar: the dashboard also has an "Assessments" stat-card link
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Assessments" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(data.length);

  const done = data.find((a) => a.status === "Completed" && a.findings.length)!;
  await page.goto(`/assessments/${done.uid}`);
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();

  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByText("Scope approved.", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: "Policy", exact: true }).click();
  await expect(page.locator("ol.m-0 li").first()).toContainText("POLICY");

  await page.getByRole("link", { name: /^Findings \(/ }).click();
  // the findings tab lists the run's findings; each row links to the finding's own page
  await expect(page.getByRole("link", { name: done.findings[0].title }).first()).toBeVisible();

  await page.getByRole("link", { name: "Scope & policy" }).click();
  await expect(page.getByText("BLOCKED").first()).toBeVisible();

  await page.getByRole("link", { name: "Approvals", exact: true }).click();
  await expect(page.getByText("APPROVED").first()).toBeVisible();
});

test("a waiting assessment asks for a decision in the AI Assistant", async ({ page }) => {
  const waiting = sample().find((a) => a.status === "Awaiting input")!;
  await page.goto(`/assessments/${waiting.uid}`);
  await expect(page.getByText("Needs your decision:")).toBeVisible();
});

test("findings filter by severity and search", async ({ page }) => {
  const findings = sample().flatMap((a) => a.findings);
  const onePage = (n: number) => Math.min(n, 10);
  await page.goto("/findings");
  await expect(page.locator("tbody tr")).toHaveCount(onePage(findings.length));
  const severity = page.getByRole("region", { name: "Filter by severity" });
  await severity.getByRole("link", { name: "High" }).click(); // the tile reads "High <count>"
  await expect(page).toHaveURL(/[?&]sev=HIGH/);
  await expect(page.locator("tbody tr")).toHaveCount(onePage(findings.filter((f) => f.severity === "HIGH").length));
  await page.goto("/findings?q=cookie");
  await expect(page.locator("tbody tr")).toHaveCount(onePage(findings.filter((f) => f.title.toLowerCase().includes("cookie")).length) || 1);
});

test("findings page through 10 at a time, and a row opens the finding", async ({ page }) => {
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
  // a row opens the finding on its own page
  await page.locator("tbody tr a").first().click();
  await expect(page).toHaveURL(/\/findings\/.+/);
  await expect(page.getByRole("link", { name: "← All findings" })).toBeVisible();
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

test("the documentation page explains the project", async ({ page }) => {
  await page.getByRole("link", { name: "Documentation" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: "Documentation", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview", level: 2 })).toBeVisible();
  // the sub-nav moves between the four sections
  const nav = page.getByRole("navigation", { name: "Documentation sections" });
  await nav.getByRole("link", { name: "Architecture" }).click();
  await expect(page).toHaveURL(/\/about\?s=architecture/);
  await expect(page.getByRole("heading", { name: "Architecture", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Findings explained", level: 2 })).toHaveCount(0);
});

test("an unknown assessment is a 404 page", async ({ page }) => {
  const res = await page.goto("/assessments/20260101-000000-ffff_RCX-NOPE-001");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Not found")).toBeVisible();
});
