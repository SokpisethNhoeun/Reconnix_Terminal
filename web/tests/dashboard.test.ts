/* The globe dashboard's numbers: adapt.ts (saved assessment → viewer terms) and derive.ts
   (every number and series on the page). Pure functions, checked against the sample files. */
import { describe, expect, it } from "vitest";

import { deriveDashboard } from "@/components/dashboard/derive";
import { deriveOverall } from "@/components/dashboard/derive-overall";
import { assessmentView, findingView, kindOf } from "@/lib/data/adapt";
import type { Assessment, Finding } from "@/lib/data/schema";

import { sampleAssessments } from "./fixtures";

const samples = sampleAssessments();
const waiting = samples.find((a) => a.status === "Awaiting input")!;
const completed = samples.find((a) => a.status === "Completed" && a.template.name === "Web URL")!;

describe("kindOf", () => {
  it.each([
    [{ who: "POLICY", tone: "block", text: "Blocked: Path excluded from the review" }, "policy"],
    [{ who: "POLICY", tone: "warn", text: "Risk: HIGH · needs a double check" }, "gate"],
    [{ who: "POLICY", tone: "ok", text: "Scope check: passed" }, "scope"],
    [{ who: "TOOL", tone: "default", text: "Executing permitted scan · Semgrep" }, "tool"],
    [{ who: "USER", tone: "ok", text: "Scope approved" }, "scope"],
    [{ who: "USER", tone: "ok", text: "Approved: secret_validation (double-checked)" }, "user"],
    [{ who: "AI", tone: "default", text: "Evidence recorded (masked)" }, "mask"],
    [{ who: "AI", tone: "default", text: "Candidate F-001 · hardcoded secret" }, "finding"],
    [{ who: "SYS", tone: "default", text: "Session started · policy engine ready" }, "info"],
  ])("%o is %s", (entry, kind) => {
    expect(kindOf(entry)).toBe(kind);
  });
});

describe("findingView", () => {
  const base = waiting.findings[0];
  it("numbers ids like the TUI and splits remediation into capitalised steps", () => {
    const f = findingView({ ...base, id: "007", remediation: "rotate the key; load secrets from the environment" });
    expect(f.id).toBe("F-007");
    expect(f.remediation).toEqual(["Rotate the key", "Load secrets from the environment"]);
  });
  it("marks masked evidence and leaves unscored findings without a CVSS", () => {
    const f = findingView({ ...base, cvss_score: 0, evidence: ["GET /a", "token: •••• (masked)", "HTTP 200"] } as Finding);
    expect(f.evidence.map((e) => e.tone)).toEqual(["request", "masked", "response"]);
    expect(f.score).toBeNull();
    expect(f.rating).toBe("no CVSS");
  });
});

describe("assessmentView", () => {
  it("reads what a waiting run waits on", () => {
    const v = assessmentView(waiting);
    expect(v.unfinished).toBe(true);
    expect(v.gate?.text).toContain("awaiting approval");
    expect(v.approvals.some((p) => p.state === "PENDING")).toBe(true);
  });
  it("counts policy checks from the verdicts", () => {
    const v = assessmentView(completed);
    expect(v.checks.total).toBe(completed.verdicts.length);
    expect(v.checks.blocked).toBe(completed.verdicts.filter((x) => !x.allowed).length);
  });
  it("has no gate once the run is over", () => {
    expect(assessmentView(completed).gate).toBeNull();
  });
});

describe("deriveDashboard", () => {
  it.each(samples.map((a) => [a.uid, a] as [string, Assessment]))("%s: numbers agree with the file", (_uid, a) => {
    const d = deriveDashboard(assessmentView(a));
    const real = a.findings.filter((f) => f.status !== "false-positive");
    expect(d.findingTotal).toBe(real.length);
    expect(d.severity.reduce((n, s) => n + s.count, 0)).toBe(real.length);
    expect(d.cards.statCards[0].value).toBe(String(real.length));
    expect(d.cards.statCards[1].value).toBe(String(a.verdicts.length));
    expect(d.requests).toBe(a.run.requests);
    expect(d.log).toHaveLength(a.timeline.filter((e) => e.type === "activity").length);
    expect(d.cards.gauge.lit).toBe(Math.round((d.cards.gauge.ticks * d.assessment.progress) / 100));
  });

  it("keeps every chart position on the axis and labels every lane", () => {
    for (const a of samples) {
      const d = deriveDashboard(assessmentView(a));
      const positions = [
        ...d.cards.activity.bars.map((b) => b.pos),
        ...d.cards.activity.peaks.map((p) => p.pos),
        ...d.cards.execution.lanes.flatMap((l) => [l.start, l.end]),
        d.cards.execution.currentPos,
      ];
      expect(positions.every((p) => p >= 0 && p <= 1)).toBe(true);
      expect(d.cards.execution.lanes.every((l) => l.label.length > 0)).toBe(true);
    }
  });

  it("pulses the gate a waiting run waits on, and nothing for a finished run", () => {
    expect(deriveDashboard(assessmentView(waiting)).cards.execution.lanes.filter((l) => l.pulse)).toHaveLength(1);
    expect(deriveDashboard(assessmentView(completed)).cards.execution.lanes.filter((l) => l.pulse)).toHaveLength(0);
  });

  it("asks the Ask bar's questions about what the run holds", () => {
    const q = deriveDashboard(assessmentView(waiting)).cards.ask.questions;
    expect(q[0]).toBe("What is this run waiting for?");
    expect(q.length).toBeGreaterThan(0);
    expect(q.length).toBeLessThanOrEqual(3);
    expect(deriveDashboard(assessmentView(completed)).cards.ask.questions).not.toContain("What is this run waiting for?");
  });

  it("keeps a long run's execution timeline readable, with its pending gate", () => {
    const tool = (i: number) => ({ seq: i, at: new Date(Date.parse(waiting.created_at) + i * 30_000).toISOString(), type: "activity" as const, who: i % 2 ? "TOOL" : "POLICY", kind: "line", text: i % 2 ? `Executing permitted scan · tool${i}` : "Blocked: out of scope", tone: i % 2 ? "default" : "block", rows: [] });
    const long = { ...waiting, timeline: [...Array.from({ length: 300 }, (_, i) => tool(i)), ...waiting.timeline.slice(-3)] };
    const d = deriveDashboard(assessmentView(long));
    expect(d.cards.execution.lanes.length).toBeLessThanOrEqual(28);
    expect(d.cards.execution.lanes.some((l) => l.pulse)).toBe(true);
  });

  it("merges the same tool's back-to-back steps into one segment", () => {
    const at = (s: number) => new Date(Date.parse(completed.created_at) + s * 1000).toISOString();
    const line = (s: number, text: string) => ({ seq: s, at: at(s), type: "activity" as const, who: "TOOL", kind: "line", text, tone: "default", rows: [] });
    const run = { ...completed, timeline: [line(0, "Executing permitted scan · Nuclei"), line(10, "Nuclei: checks on the permitted surface"), line(20, "Executing permitted scan · OWASP ZAP")] };
    const labels = deriveDashboard(assessmentView(run)).cards.execution.lanes.map((l) => l.label);
    expect(labels).toEqual(["Nuclei", "OWASP ZAP"]);
  });

  it("flags minutes over the scope's time limit", () => {
    const late = { ...completed, run: { ...completed.run, finished_at: new Date(Date.parse(completed.run.started_at!) + 3 * 3_600_000).toISOString() } };
    expect(deriveDashboard(assessmentView(late)).minutes.over).toBe(true);
    expect(deriveDashboard(assessmentView(completed)).minutes.over).toBe(false);
  });

  it("draws no time axis for a run with no log yet", () => {
    const d = deriveDashboard(assessmentView({ ...completed, timeline: [] }));
    expect(d.cards.execution.ticks).toEqual([]);
    expect(d.cards.tools.ticks).toEqual([]);
  });

  it("leaves false positives out of the counts", () => {
    const one = { ...completed, findings: completed.findings.map((f, i) => (i === 0 ? { ...f, status: "false-positive" } : f)) };
    expect(deriveDashboard(assessmentView(one)).findingTotal).toBe(completed.findings.length - 1);
  });
});

describe("deriveOverall", () => {
  const views = samples.map(assessmentView);
  const all = deriveOverall(views);
  const real = samples.flatMap((a) => a.findings).filter((f) => f.status !== "false-positive");

  it("totals every saved run", () => {
    const stat = (label: string) => all.cards.statCards.find((c) => c.label === label)!.value;
    expect(all.runs).toBe(samples.length);
    expect(stat("Assessments")).toBe(String(samples.length));
    expect(stat("Findings")).toBe(String(real.length));
    expect(stat("Policy checks")).toBe(String(samples.reduce((n, a) => n + a.verdicts.length, 0)));
    expect(stat("Blocked by policy")).toBe(String(samples.reduce((n, a) => n + a.verdicts.filter((v) => !v.allowed).length, 0)));
    expect(all.cards.findings.severity.reduce((n, s) => n + s.count, 0)).toBe(real.length);
    expect(all.cards.tools.used).toBe(samples.reduce((n, a) => n + a.timeline.filter((e) => e.type === "activity" && e.who === "TOOL").length, 0));
    expect(all.cards.tools.bars.at(-1)!.value).toBe(all.cards.tools.used);
    expect(all.waiting).toBe(samples.filter((a) => a.status === "Awaiting input").length);
    expect(all.statuses.reduce((n, s) => n + s.count, 0)).toBe(samples.length);
  });

  it("shows the share of runs completed", () => {
    const completed = samples.filter((a) => a.status === "Completed").length;
    expect(all.cards.gauge.value).toBe(Math.round((completed / samples.length) * 100));
    expect(all.cards.gauge.caption).toBe(`${completed} of ${samples.length} completed`);
  });

  it("lists every run's findings once, keyed by their run", () => {
    expect(all.findings).toHaveLength(samples.reduce((n, a) => n + a.findings.length, 0));
    expect(new Set(all.findings.map((f) => f.key)).size).toBe(all.findings.length);
    expect(all.findings.every((f) => f.run && f.key === `${f.run.uid}~${f.id}`)).toBe(true);
    expect(all.cards.findings.top.every((t) => t.run !== null)).toBe(true);
  });

  it("puts every run on the axis, oldest first, and pulses the waiting ones", () => {
    const { lanes } = all.cards.execution;
    const positions = [...all.cards.activity.bars.map((b) => b.pos), ...all.cards.activity.peaks.map((p) => p.pos), ...lanes.flatMap((l) => [l.start, l.end])];
    expect(positions.every((p) => p >= 0 && p <= 1)).toBe(true);
    expect(lanes).toHaveLength(samples.length);
    expect(lanes.filter((l) => l.pulse)).toHaveLength(all.waiting);
    const starts = lanes.map((l) => l.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(all.cards.activity.bars.filter((b) => b.hasEvent).length).toBeGreaterThan(0);
  });

  it("keeps a single run readable", () => {
    const one = deriveOverall([views[0]]);
    expect(one.runs).toBe(1);
    expect(one.cards.execution.lanes).toHaveLength(1);
    expect(one.cards.execution.lanes[0].start).toBeCloseTo(0.5);
    expect(one.cards.ask.reach).toBe("1 target");
  });
});
