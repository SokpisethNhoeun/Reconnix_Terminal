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
  await page.goto("/findings");
  await expect(page.locator("tbody tr")).toHaveCount(findings.length);
  await page.getByRole("link", { name: "High", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(findings.filter((f) => f.severity === "HIGH").length);
  await page.goto("/findings?q=cookie");
  await expect(page.locator("tbody tr")).toHaveCount(findings.filter((f) => f.title.toLowerCase().includes("cookie")).length || 1);
});

test("policy shows blocked requests and decisions", async ({ page }) => {
  await page.goto("/policy");
  await expect(page.getByRole("heading", { name: "Blocked requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approval decisions" })).toBeVisible();
  await expect(page.getByText("REJECTED").first()).toBeVisible();
});

test("the theme toggle switches to dark and back", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await page.getByRole("button", { name: "Switch to the dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to the light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("an unknown assessment is a 404 page", async ({ page }) => {
  const res = await page.goto("/assessments/20260101-000000-ffff_RCX-NOPE-001");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Not found")).toBeVisible();
});
