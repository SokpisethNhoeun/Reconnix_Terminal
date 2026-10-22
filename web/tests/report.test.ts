/* The Report view's data (derive-report.ts), for one run and for every saved run, checked
   against the sample files: every count agrees with what the files hold and the policy tiles are
   gone. Its Findings tile counts every finding, like the Overview's strip, and its Findings by
   Severity card counts the same findings on the four levels it lists. */
import { describe, expect, it } from "vitest";

import { deriveDashboard } from "@/components/dashboard/derive";
import { deriveOverall } from "@/components/dashboard/derive-overall";
import { overallReportCards, reportCards, worstOf } from "@/components/dashboard/derive-report";
import type { Stat } from "@/components/dashboard/stat-types";
import { assessmentView } from "@/lib/data/adapt";
import type { Assessment } from "@/lib/data/schema";

import { sampleAssessments } from "./fixtures";

const samples = sampleAssessments();
const views = samples.map(assessmentView);
const withFindings = samples.find((a) => a.findings.length > 1)!;
const stat = (stats: Stat[], label: string) => stats.find((s) => s.label === label)!;
const counted = (a: Assessment) => a.findings.filter((f) => f.status !== "false-positive" && f.validation !== "FALSE_POSITIVE");
const report = (a: Assessment) => {
  const v = assessmentView(a);
  const d = deriveDashboard(v);
  return reportCards(v, d.findings, d.cards.findings) as Extract<ReturnType<typeof reportCards>, { mode: "run" }>;
};

describe("one run's report", () => {
  it("has no policy tiles: findings, plan steps, requests and masked evidence", () => {
    const r = report(withFindings);
    expect(r.stats.map((s) => s.label)).toEqual(["Findings", "Plan steps", "Requests sent", "Masked evidence"]);
    expect(JSON.stringify(r.stats)).not.toMatch(/polic|blocked/i);
  });

  it("counts what the file holds", () => {
    const a = withFindings;
    const r = report(a);
    expect(stat(r.stats, "Findings").value).toBe(String(counted(a).length));
    expect(stat(r.stats, "Requests sent").value).toBe(String(a.run.requests));
    const done = a.plan.filter((p) => p.status === "done").length;
    expect(stat(r.stats, "Plan steps").value).toBe(`${done}/${a.plan.length}`);
    const masks = assessmentView(a).log.filter((l) => l.kind === "mask").length;
    expect(stat(r.stats, "Masked evidence").value).toBe(String(masks));
    expect(r.rows).toHaveLength(a.findings.length);
    expect(r.plan.map((p) => p.label)).toEqual(a.plan.map((p) => p.label));
    expect(r.uid).toBe(a.uid);
  });

  it("lists the worst findings first, each with its review state", () => {
    const r = report(withFindings);
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    for (let i = 1; i < r.rows.length; i++) expect(order.indexOf(r.rows[i - 1].severity)).toBeLessThanOrEqual(order.indexOf(r.rows[i].severity));
    expect(r.rows.every((f) => ["Confirmed", "Needs review", "Closed", "Fixed", "Accepted", "False positive"].includes(f.review.label))).toBe(true);
  });
});

describe("every run's report", () => {
  const overall = deriveOverall(views);
  const r = overallReportCards(views, overall.cards.findings) as Extract<ReturnType<typeof overallReportCards>, { mode: "all" }>;

  it("totals the runs, findings and requests", () => {
    expect(stat(r.stats, "Runs").value).toBe(String(samples.length));
    expect(stat(r.stats, "Findings").value).toBe(String(overall.findingTotal));
    expect(stat(r.stats, "Requests sent").value).toBe(String(samples.reduce((n, a) => n + a.run.requests, 0)));
    expect(JSON.stringify(r.stats)).not.toMatch(/polic|blocked/i);
  });

  it("has one row per run, newest first, with its findings and worst severity", () => {
    expect(r.runs.map((x) => x.uid)).toEqual(views.map((v) => v.uid));
    for (const row of r.runs) {
      const a = samples.find((x) => x.uid === row.uid)!;
      const v = assessmentView(a);
      const kept = v.findings.filter((f) => !f.falsePositive);
      expect(row.findings).toBe(kept.length);
      expect(row.worst).toBe(worstOf(kept.map((f) => f.severity)));
    }
  });

  it("counts the same findings in the Findings tile and on the Findings by Severity card", () => {
    const real = views.flatMap((v) => v.findings).filter((f) => !f.falsePositive).length;
    expect(r.findings.severity.map((s) => s.level)).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
    expect(Number(stat(r.stats, "Findings").value)).toBe(r.findings.total);
    expect(r.findings.total).toBe(real);
  });

  it("sums the targets' findings to the total", () => {
    expect(r.targets.reduce((n, t) => n + t.findings, 0)).toBe(overall.findingTotal);
    expect(r.targets.reduce((n, t) => n + t.runs, 0)).toBe(samples.length);
  });

  it("names the worst severity, or none", () => {
    expect(worstOf(["LOW", "HIGH", "MEDIUM"])).toBe("HIGH");
    expect(worstOf([])).toBeNull();
  });
});
