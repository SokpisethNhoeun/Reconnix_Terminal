/* The Scope and Report views' data (derive-scope.ts, derive-report.ts), for one run and for every
   saved run, checked against the sample files: every count agrees with what the files hold,
   waiting approvals come first, the policy tiles are gone from the Report, and text from targets
   is masked. */
import { describe, expect, it } from "vitest";

import { deriveDashboard } from "@/components/dashboard/derive";
import { deriveOverall } from "@/components/dashboard/derive-overall";
import { overallReportCards, reportCards, worstOf } from "@/components/dashboard/derive-report";
import { approvalBadges, MAX_APPROVALS, overallScopeCards, scopeCards, targetRows } from "@/components/dashboard/derive-scope";
import { countChips } from "@/components/dashboard/derive-shared";
import type { Stat } from "@/components/dashboard/stat-types";
import { MASK } from "@/lib/assistant/redact";
import { assessmentView } from "@/lib/data/adapt";
import type { Assessment } from "@/lib/data/schema";
import { APPROVAL_STATE, SCOPE_STATE, TIME_LIMIT } from "@/lib/status";

import { sampleAssessments } from "./fixtures";

const samples = sampleAssessments();
const views = samples.map(assessmentView);
const waiting = samples.find((a) => a.status === "Awaiting input")!;
const withFindings = samples.find((a) => a.findings.length > 1)!;
const stat = (stats: Stat[], label: string) => stats.find((s) => s.label === label)!;
const counted = (a: Assessment) => a.findings.filter((f) => f.status !== "false-positive" && f.validation !== "FALSE_POSITIVE");
const report = (a: Assessment) => {
  const v = assessmentView(a);
  const d = deriveDashboard(v);
  return reportCards(v, d.findings, d.cards.findings) as Extract<ReturnType<typeof reportCards>, { mode: "run" }>;
};

describe("one run's scope", () => {
  it("counts the boundary, the requests and the time from the file", () => {
    const a = waiting;
    const c = scopeCards(assessmentView(a));
    expect(c.mode).toBe("run");
    expect(stat(c.stats, "In scope").value).toBe(String(1 + a.scope!.allowed_ports.length));
    expect(stat(c.stats, "Excluded").value).toBe(String(a.scope!.excluded_paths.length));
    expect(stat(c.stats, "Approvals").value).toBe(String(a.approvals.length));
    expect(stat(c.stats, "Time window").value).toBe(`${a.scope!.time_limit_minutes} min`);
    expect(c.boundary).toMatchObject({ mode: "run", ports: a.scope!.allowed_ports.map(String), exclude: a.scope!.excluded_paths });
    expect(c.permitted.actions.map((x) => x.label)).toEqual(a.scope!.allowed_actions);
    expect(c.permitted.tools.map((x) => x.label)).toEqual(a.scope!.tools);
  });

  it("shows the waiting approval with its state and risk as badges", () => {
    const c = scopeCards(assessmentView(waiting));
    expect(c.approvals.rows.map((r) => r.state.label)).toContain(APPROVAL_STATE.PENDING.label);
    expect(c.approvals.rows.every((r) => r.risk.label.endsWith("risk") && r.run === null)).toBe(true);
    expect(stat(c.stats, "Approvals").badges.map((b) => b.type === "status" && b.meaning.label)).toContain("1 waiting");
  });

  it("says when a run has no Scope Manifest yet, and draws nothing else", () => {
    const c = scopeCards(assessmentView({ ...waiting, scope: null, approvals: [] }));
    expect(c.empty).toBe(SCOPE_STATE.none.hint);
    expect(c.stats).toEqual([]);
  });

  it("marks a run that went past its time limit", () => {
    const a = samples.find((x) => x.scope && x.run.started_at && x.run.finished_at)!;
    const start = Date.parse(a.run.started_at!);
    const late = { ...a, scope: { ...a.scope!, time_limit_minutes: 1 }, run: { ...a.run, finished_at: new Date(start + 5 * 60_000).toISOString() } };
    const c = scopeCards(assessmentView(late));
    const time = stat(c.stats, "Time window");
    expect(time.badges).toEqual([{ type: "status", meaning: TIME_LIMIT.over }]);
    expect(time.meter).toMatchObject({ frac: 1, over: true });
    expect(c.limits.usage).toMatchObject({ over: true, caption: "5m 00s used of 1 min" });
  });

  it("masks secrets in targets and approval text", () => {
    const leaky = { ...waiting, target: "https://api.example.com/?token=hunter2hunter2", scope: { ...waiting.scope!, target_url: "https://api.example.com/?token=hunter2hunter2" } };
    const c = scopeCards(assessmentView(leaky));
    expect(JSON.stringify(c)).not.toContain("hunter2");
    expect(c.boundary.mode === "run" && c.boundary.target).toContain(MASK);
  });
});

describe("every run's scope", () => {
  const c = overallScopeCards(views);

  it("lists every target once, with its runs, the most tested first", () => {
    const targets = targetRows(views);
    expect(targets.reduce((n, t) => n + t.runs, 0)).toBe(samples.length);
    expect(new Set(targets.map((t) => t.target)).size).toBe(new Set(samples.map((a) => a.target)).size);
    for (let i = 1; i < targets.length; i++) expect(targets[i - 1].runs).toBeGreaterThanOrEqual(targets[i].runs);
    expect(stat(c.stats, "Targets").value).toBe(String(targets.length));
  });

  it("counts approved scopes and every approval request", () => {
    const approved = samples.filter((a) => a.scope?.status === "APPROVED").length;
    expect(stat(c.stats, "Scopes approved").value).toBe(`${approved}/${samples.length}`);
    const total = samples.reduce((n, a) => n + a.approvals.length, 0);
    expect(stat(c.stats, "Approvals").value).toBe(String(total));
    expect(c.approvals.rows.length).toBe(Math.min(total, MAX_APPROVALS));
    expect(c.approvals.more).toBe(Math.max(0, total - MAX_APPROVALS));
  });

  it("puts the waiting requests first, each naming its run", () => {
    expect(c.approvals.rows[0].state).toEqual(APPROVAL_STATE.PENDING);
    expect(c.approvals.rows[0].run?.uid).toBe(waiting.uid);
    expect(c.approvals.rows.every((r) => r.run !== null && r.key.startsWith(`${r.run.uid}~`))).toBe(true);
  });

  it("counts in how many runs each action and tool is allowed", () => {
    const scoped = samples.filter((a) => a.scope);
    for (const chip of c.permitted.tools) expect(chip.count).toBe(scoped.filter((a) => a.scope!.tools.includes(chip.label)).length);
    expect(countChips([["a", "a", "b"], ["a"]], (v, n) => `${v}:${n}`)).toEqual([
      { label: "a", count: 2, title: "a:2" },
      { label: "b", count: 1, title: "b:1" },
    ]);
  });

  it("badges approval states in their own words, waiting first", () => {
    const states = (["APPROVED", "PENDING", "APPROVED", "NOT REACHED"] as const).map((state) => ({ state }));
    expect(approvalBadges(states).map((b) => b.type === "status" && b.meaning.label)).toEqual(["1 waiting", "2 approved", "1 not reached"]);
  });
});

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
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
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

  it("sums the targets' findings to the total", () => {
    expect(r.targets.reduce((n, t) => n + t.findings, 0)).toBe(overall.findingTotal);
    expect(r.targets.reduce((n, t) => n + t.runs, 0)).toBe(samples.length);
  });

  it("names the worst severity, or none", () => {
    expect(worstOf(["LOW", "HIGH", "MEDIUM"])).toBe("HIGH");
    expect(worstOf([])).toBeNull();
  });
});
