/* The globe dashboard's numbers: adapt.ts (saved assessment → viewer terms), derive.ts (one run)
   and derive-overall.ts (every run), with their axis and event helpers. Pure functions, checked
   against the sample files: sums agree with the files, positions stay on the axis, no marks
   overlap, and log text is masked. */
import { describe, expect, it } from "vitest";

import { CLUSTER_GAP, cluster, countTicks, MAX_SEGMENTS, mergeNarrow, type Segment, ticksAt } from "@/components/dashboard/axis";
import { deriveDashboard } from "@/components/dashboard/derive";
import { deriveOverall, LATEST_RUNS } from "@/components/dashboard/derive-overall";
import { eventBadge, LANE_ORDER, toolsNamed } from "@/components/dashboard/event-kinds";
import type { ActivityCard, ExecutionCard } from "@/components/dashboard/overview-types";
import { tabStop } from "@/components/dashboard/use-mark-nav";
import { MASK } from "@/lib/assistant/redact";
import { assessmentView, findingView, kindOf } from "@/lib/data/adapt";
import type { Assessment, Finding } from "@/lib/data/schema";
import { APPROVAL_STATE, POLICY_DECISION, STEP_STATUS } from "@/lib/status";

import { sampleAssessments } from "./fixtures";

const samples = sampleAssessments();
const waiting = samples.find((a) => a.status === "Awaiting input")!;
const completed = samples.find((a) => a.status === "Completed" && a.template.name === "Web URL")!;
const activityOf = (a: Assessment) => deriveDashboard(assessmentView(a)).cards.activity as Extract<ActivityCard, { mode: "events" }>;
const executionOf = (a: Assessment) => deriveDashboard(assessmentView(a)).cards.execution as Extract<ExecutionCard, { mode: "phases" }>;
const inAxis = (p: number) => p >= 0 && p <= 1;
const tools = (a: Assessment) => a.timeline.filter((e) => e.type === "activity" && e.who === "TOOL");
const line = (a: Assessment, s: number, who: string, text: string, tone = "default") => ({
  seq: s,
  at: new Date(Date.parse(a.created_at) + s * 1000).toISOString(),
  type: "activity" as const,
  who,
  kind: "line",
  text,
  tone,
  rows: [],
});

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

// --- axis helpers -------------------------------------------------------------------------

describe("axis helpers", () => {
  it("clusters close items so no two groups are within the gap", () => {
    const items = [0, 0.01, 0.02, 0.3, 0.33, 0.9, 1].map((pos, i) => ({ pos, item: i }));
    const groups = cluster(items);
    expect(groups.map((g) => g.items.length)).toEqual([3, 2, 1, 1]);
    for (let i = 1; i < groups.length; i++) expect(groups[i].start - groups[i - 1].end).toBeGreaterThan(CLUSTER_GAP);
    expect(groups.flatMap((g) => g.items)).toEqual(items.map((x) => x.item));
  });
  it("merges the narrowest tool segments until they fit, keeping order and coverage", () => {
    const segs: Segment[] = Array.from({ length: 60 }, (_, i) => ({ key: String(i), tools: [`t${i % 4}`], start: i / 60, end: (i + 1) / 60, steps: 1, times: [String(i)] }));
    const out = mergeNarrow(segs);
    expect(out.length).toBe(MAX_SEGMENTS);
    expect(out.reduce((n, s) => n + s.steps, 0)).toBe(60);
    for (let i = 1; i < out.length; i++) expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].end);
  });
  it("labels ticks without repeating a label", () => {
    expect(ticksAt([0, 0.5, 1], (p) => (p < 1 ? "5 Oct" : "6 Oct")).map((t) => t.label)).toEqual(["5 Oct", "6 Oct"]);
  });
  it("puts round count ticks up to at least the maximum", () => {
    expect(countTicks(2)).toEqual({ ticks: [0, 1, 2], top: 2 });
    expect(countTicks(13)).toEqual({ ticks: [0, 5, 10, 15], top: 15 });
    expect(countTicks(0).top).toBe(1);
  });
});

describe("event badges", () => {
  const at = { pendingGate: false, liveTool: false, severityOf: (id: string) => (id === "F-001" ? ("HIGH" as const) : undefined) };
  it("reads the status a line records", () => {
    expect(eventBadge("policy", "Blocked: Path excluded", at)).toEqual({ type: "status", meaning: POLICY_DECISION.blocked });
    expect(eventBadge("gate", "Risk: HIGH · needs a double check", { ...at, pendingGate: true })).toEqual({ type: "status", meaning: APPROVAL_STATE.PENDING });
    expect(eventBadge("user", "Approved: secret_validation (double-checked)", at)).toEqual({ type: "status", meaning: APPROVAL_STATE.APPROVED });
    expect(eventBadge("user", "Rejected: limited_validation", at)).toEqual({ type: "status", meaning: APPROVAL_STATE.REJECTED });
    expect(eventBadge("scope", "Scope check: passed", at)).toEqual({ type: "status", meaning: POLICY_DECISION.allowed });
    expect(eventBadge("scope", "Scope Manifest drafted · pending approval", at).type).toBe("status");
    expect(eventBadge("tool", "Executing baseline request", { ...at, liveTool: true })).toEqual({ type: "status", meaning: STEP_STATUS.active });
    expect(eventBadge("finding", "Candidate F-001 · hardcoded secret", at)).toEqual({ type: "severity", level: "HIGH" });
  });
  it("names only approved tools as tools used", () => {
    expect(toolsNamed(["Executing permitted scan · Semgrep", "Semgrep: checks", "Executing baseline request"], ["Semgrep", "gitleaks"])).toEqual(["Semgrep"]);
  });
});

// --- one run ----------------------------------------------------------------------------

describe("deriveDashboard", () => {
  it.each(samples.map((a) => [a.uid, a] as [string, Assessment]))("%s: numbers agree with the file", (_uid, a) => {
    const d = deriveDashboard(assessmentView(a));
    const real = a.findings.filter((f) => f.status !== "false-positive");
    const activity = a.timeline.filter((e) => e.type === "activity");
    const { summary, findings } = d.cards;
    expect(d.cards.mode).toBe("run");
    expect(d.findingTotal).toBe(real.length);
    expect(summary.findings.total).toBe(real.length);
    expect(findings.severity.reduce((n, s) => n + s.count, 0)).toBe(real.length);
    expect(findings.review.confirmed + findings.review.needsReview + findings.review.closed).toBe(real.length);
    expect(summary.tools.steps).toBe(tools(a).length);
    expect(summary.tools.requests).toBe(a.run.requests);
    expect(summary.progress.pct).toBe(d.assessment.progress);
    expect(summary.progress.status).toBe(a.status);
    expect(d.requests).toBe(a.run.requests);
    // the raw log stays on the server: only the masked event copies reach the page
    expect(d).not.toHaveProperty("log");
    expect(d).not.toHaveProperty("window");
    // every log line is in its own kind's lane exactly once
    const lanes = activityOf(a).lanes;
    expect(lanes.map((l) => l.kind)).toEqual([...LANE_ORDER]);
    expect(lanes.reduce((n, l) => n + l.marks.reduce((m, k) => m + k.count, 0), 0)).toBe(activity.length);
    const log = assessmentView(a).log;
    expect(log).toHaveLength(activity.length);
    for (const l of lanes) expect(l.count).toBe(log.filter((x) => x.kind === l.kind).length);
    expect(executionOf(a).phases).toEqual(d.phases);
  });

  it("keeps every chart position on the axis, and no two marks of a lane overlap", () => {
    for (const a of samples) {
      const act = activityOf(a);
      const exe = executionOf(a);
      for (const l of act.lanes) {
        for (const m of l.marks) expect(inAxis(m.start) && inAxis(m.end) && m.start <= m.end).toBe(true);
        for (let i = 1; i < l.marks.length; i++) expect(l.marks[i].start - l.marks[i - 1].end).toBeGreaterThan(CLUSTER_GAP);
      }
      for (const s of exe.tools) expect(inAxis(s.start) && inAxis(s.end) && s.start <= s.end).toBe(true);
      for (let i = 1; i < exe.tools.length; i++) expect(exe.tools[i].start).toBeGreaterThanOrEqual(exe.tools[i - 1].end - 1e-9);
      expect([...act.ticks, ...exe.ticks].every((t) => inAxis(t.pos))).toBe(true);
      if (exe.gate?.pos != null) expect(inAxis(exe.gate.pos)).toBe(true);
    }
  });

  it("shows the gate a waiting run waits on, and none for a finished run", () => {
    const pending = (a: Assessment) => activityOf(a).lanes.flatMap((l) => l.marks).filter((m) => m.pending);
    expect(pending(waiting)).toHaveLength(1);
    expect(executionOf(waiting).gate?.meaning).toBe(APPROVAL_STATE.PENDING);
    expect(pending(completed)).toHaveLength(0);
    expect(executionOf(completed).gate).toBeNull();
  });

  it("gives every event a readable time, a label, a badge and masked text", () => {
    const secret = { ...completed, timeline: [...completed.timeline, line(completed, 900, "TOOL", "Executing replay · password=hunter2-abcdefghijklmnop123")] };
    const events = activityOf(secret).lanes.flatMap((l) => l.marks.flatMap((m) => m.events));
    expect(events.every((e) => e.when.length > 8 && e.label.length > 0 && e.badge)).toBe(true);
    const replay = events.find((e) => e.text.startsWith("Executing replay"))!;
    expect(replay.text).toContain(MASK);
    expect(replay.text).not.toContain("abcdefghijklmnop123");
  });

  it("asks the Ask bar's questions about what the run holds", () => {
    const q = deriveDashboard(assessmentView(waiting)).cards.ask.questions;
    expect(q[0]).toBe("What is this run waiting for?");
    expect(q.length).toBeGreaterThan(0);
    expect(q.length).toBeLessThanOrEqual(3);
    expect(deriveDashboard(assessmentView(completed)).cards.ask.questions).not.toContain("What is this run waiting for?");
  });

  it("keeps a long run readable: clustered lanes, at most 24 tool segments, its pending gate", () => {
    const busy = (i: number) => (i % 2 ? line(waiting, i * 3, "TOOL", `Executing permitted scan · tool${i % 7}`) : line(waiting, i * 3, "POLICY", "Blocked: out of scope", "block"));
    const long = { ...waiting, timeline: [...Array.from({ length: 300 }, (_, i) => busy(i)), ...waiting.timeline.slice(-3)] };
    const act = activityOf(long);
    const exe = executionOf(long);
    expect(exe.tools.length).toBeLessThanOrEqual(MAX_SEGMENTS);
    expect(exe.tools.reduce((n, s) => n + s.steps, 0)).toBe(long.timeline.filter((e) => e.type === "activity" && e.who === "TOOL").length);
    for (const l of act.lanes) for (let i = 1; i < l.marks.length; i++) expect(l.marks[i].start - l.marks[i - 1].end).toBeGreaterThan(CLUSTER_GAP);
    expect(act.lanes.flatMap((l) => l.marks).some((m) => m.pending)).toBe(true);
  });

  it("merges the same tool's back-to-back steps into one segment", () => {
    const run = {
      ...completed,
      timeline: [
        line(completed, 0, "TOOL", "Executing permitted scan · Nuclei"),
        line(completed, 10, "TOOL", "Nuclei: checks on the permitted surface"),
        line(completed, 20, "TOOL", "Executing permitted scan · OWASP ZAP"),
      ],
    };
    expect(executionOf(run).tools.map((s) => s.label)).toEqual(["Nuclei", "OWASP ZAP"]);
    expect(deriveDashboard(assessmentView(run)).cards.summary.tools.tools).toEqual(["Nuclei", "OWASP ZAP"]);
  });

  it("flags time over the scope's limit", () => {
    const late = { ...completed, run: { ...completed.run, finished_at: new Date(Date.parse(completed.run.started_at!) + 3 * 3_600_000).toISOString() } };
    const d = deriveDashboard(assessmentView(late));
    expect(d.minutes.over).toBe(true);
    expect(d.cards.summary.duration.over).toBe(1);
    expect(d.cards.summary.duration.frac).toBe(1);
    expect(deriveDashboard(assessmentView(completed)).cards.summary.duration.over).toBe(0);
  });

  it("draws no time axis for a run with no log yet, and says so", () => {
    const d = deriveDashboard(assessmentView({ ...completed, timeline: [] }));
    expect(activityOf({ ...completed, timeline: [] }).ticks).toEqual([]);
    expect(executionOf({ ...completed, timeline: [] }).ticks).toEqual([]);
    expect((d.cards.activity as Extract<ActivityCard, { mode: "events" }>).empty).toBeTruthy();
  });

  it("leaves false positives out of the counts, and keeps the shares whole", () => {
    const one = { ...completed, findings: completed.findings.map((f, i) => (i === 0 ? { ...f, status: "false-positive" } : f)) };
    const d = deriveDashboard(assessmentView(one));
    expect(d.findingTotal).toBe(completed.findings.length - 1);
    expect(d.cards.findings.severity.reduce((n, s) => n + s.frac, 0)).toBeCloseTo(1);
    const scores = d.cards.findings.top.map((t) => t.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

// --- every run ----------------------------------------------------------------------------

describe("deriveOverall", () => {
  const views = samples.map(assessmentView);
  const all = deriveOverall(views);
  const real = samples.flatMap((a) => a.findings).filter((f) => f.status !== "false-positive");
  const days = all.cards.activity as Extract<ActivityCard, { mode: "days" }>;
  const runs = all.cards.execution as Extract<ExecutionCard, { mode: "runs" }>;

  it("totals every saved run", () => {
    const { summary } = all.cards;
    expect(all.cards.mode).toBe("all");
    expect(all.runs).toBe(samples.length);
    expect(summary.findings.total).toBe(real.length);
    expect(all.cards.findings.severity.reduce((n, s) => n + s.count, 0)).toBe(real.length);
    expect(summary.tools.steps).toBe(samples.reduce((n, a) => n + tools(a).length, 0));
    expect(summary.tools.requests).toBe(samples.reduce((n, a) => n + a.run.requests, 0));
    expect(all.waiting).toBe(samples.filter((a) => a.status === "Awaiting input").length);
    expect(all.statuses.reduce((n, s) => n + s.count, 0)).toBe(samples.length);
  });

  it("shows the share of runs completed", () => {
    const done = samples.filter((a) => a.status === "Completed").length;
    expect(all.cards.summary.progress.pct).toBe(Math.round((done / samples.length) * 100));
    expect(all.cards.summary.progress.caption).toBe(`${done} of ${samples.length} runs completed`);
    expect(all.cards.summary.progress.status).toBeNull();
  });

  it("lists every run's findings once, keyed by their run", () => {
    expect(all.findings).toHaveLength(samples.reduce((n, a) => n + a.findings.length, 0));
    expect(new Set(all.findings.map((f) => f.key)).size).toBe(all.findings.length);
    expect(all.findings.every((f) => f.run && f.key === `${f.run.uid}~${f.id}`)).toBe(true);
    expect(all.cards.findings.top.every((t) => t.run !== null)).toBe(true);
  });

  it("counts the runs started per day, every day on the axis, stacked by status", () => {
    expect(days.mode).toBe("days");
    expect(days.days.reduce((n, d) => n + d.total, 0)).toBe(samples.length);
    expect(days.days.reduce((n, d) => n + d.runs.length, 0)).toBe(samples.length);
    for (const d of days.days) {
      expect(d.segments.reduce((n, s) => n + s.count, 0)).toBe(d.total);
      expect(inAxis(d.pos - d.width / 2) && inAxis(d.pos + d.width / 2)).toBe(true);
    }
    for (let i = 1; i < days.days.length; i++) expect(days.days[i].pos).toBeGreaterThan(days.days[i - 1].pos);
    expect(days.max).toBeGreaterThanOrEqual(Math.max(...days.days.map((d) => d.total)));
    expect(days.yTicks.at(-1)).toBe(days.max);
    expect(days.ticks.every((t) => inAxis(t.pos))).toBe(true);
  });

  it("lists the newest runs as execution rows", () => {
    const newest = [...views].sort((a, b) => b.createdMs - a.createdMs).slice(0, LATEST_RUNS);
    expect(runs.runs.map((r) => r.uid)).toEqual(newest.map((v) => v.uid));
    expect(runs.runs.every((r) => r.steps.done <= r.steps.total && r.progress >= 0 && r.progress <= 100)).toBe(true);
  });

  it("counts per week over a long span", () => {
    const spread = views.map((v, i) => ({ ...v, createdMs: v.createdMs + i * 30 * 86_400_000 }));
    const weeks = deriveOverall(spread).cards.activity as Extract<ActivityCard, { mode: "days" }>;
    expect(weeks.unit).toBe("week");
    expect(weeks.days.reduce((n, d) => n + d.total, 0)).toBe(spread.length);
  });

  it("keeps a single run readable", () => {
    const one = deriveOverall([views[0]]);
    const oneDays = one.cards.activity as Extract<ActivityCard, { mode: "days" }>;
    expect(one.runs).toBe(1);
    expect(oneDays.days).toHaveLength(1);
    expect(oneDays.days[0].pos).toBeCloseTo(0.5);
    expect(one.cards.ask.reach).toBe("1 target");
  });
});

describe("chart tab stop", () => {
  it("keeps the remembered mark while it exists, else falls back to the first", () => {
    expect(tabStop(null, ["a", "b"])).toBe("a");
    expect(tabStop("b", ["a", "b"])).toBe("b");
    expect(tabStop("gone", ["a", "b"])).toBe("a"); // merged away by a refresh, or another run
    expect(tabStop("b", [])).toBeNull();
  });
});
