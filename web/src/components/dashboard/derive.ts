/**
 * Every number and chart series the dashboard shows, derived from one saved assessment
 * (src/lib/data/adapt.ts → AssessmentView). Components read numbers only from the Dashboard
 * this returns; none holds a literal number. If a design element needs a value the saved
 * assessment doesn't record, it does not go on the page.
 *
 * The Overview's cards read only `cards` (OverviewCards): derive-overall.ts makes the same
 * shape from every saved run at once, so one set of cards draws either.
 *
 * Runs on the server (src/app/page.tsx) and hands plain data to the views, so every label,
 * including clock times, is computed once, here. Positions on the time axis are fractions
 * (0 = the run's first log line, 1 = its last).
 */
import { clock, duration } from "@/lib/data/format";
import { SEVERITIES } from "@/lib/data/schema";
import type {
  ApprovalView,
  AssessmentView,
  FindingView,
  LogKind,
  LogLine,
  PhaseView,
  ScopeView,
  Severity,
  Tone,
} from "@/lib/data/view-types";

export type { Tone };

/** The assessment templates the TUI offers (the Template chip lists them). */
export const TEMPLATES = ["Network", "API", "Source Code", "Web URL"] as const;

export const BINS = 46; // bars across the activity charts
export const GAUGE_TICKS = 60;
const TOP_FINDINGS = 3;
const MIN_LABEL_GAP = 0.25; // two clock labels closer than this (fraction of the axis) overlap
const MAX_LANES = 28; // more marks than this on the execution timeline stop being readable
export const MAX_QUESTIONS = 3;

export type ActivityBar = { pos: number; heightPct: number; tone: Tone; title: string; hasEvent: boolean };
export type Peak = { pos: number; tone: Tone; title: string };
export type Marker = { pos: number; label: string };
export type Lane = {
  key: string;
  label: string;
  kind: "dot" | "segment";
  start: number;
  end: number;
  tone: Tone;
  pulse: boolean;
  title: string;
};
export type Ring = { used: number; max: number; label: string; over?: boolean };
export type ToolBar = { pos: number; value: number; last: boolean };
export type FindingIcon = "bug" | "code" | "database";
/** A finding as listed: `key` is unique in the list (the ID for one run, `<uid>~<ID>` across
    runs) and `run` names the assessment it came from when the list spans several. */
export type FindingRow = FindingView & { tone: Tone; icon: FindingIcon; key: string; run: { uid: string; label: string } | null };
export type SeverityCount = { level: Severity; count: number; share: number; tone: Tone };
export type TopFinding = { key: string; id: string; title: string; severity: Severity; score: number; icon: FindingIcon; run: string | null };
/** A drill-down: which view a number opens, with which filters (see view-url.ts). */
export type DrillDown = { view: "findings"; filters: Record<string, string>; label: string };
export type StatCard = { label: string; value: string; chip: string; tone: Tone; isDuration?: boolean; link?: DrillDown };

/** What the Overview's cards draw, for one run or for every saved run. */
export interface OverviewCards {
  activity: { bars: ActivityBar[]; peaks: Peak[]; lastPeak: Marker | null; brackets: Marker[]; summary: string; idle: string };
  ask: { label: string; scope: { ok: boolean; text: string }; reach: string; questions: string[] };
  statCards: StatCard[];
  execution: { lanes: Lane[]; currentPos: number; ticks: Marker[]; rings: Ring[]; chip: string; summary: string };
  gauge: { value: number; caption: string; live: boolean; ticks: number; lit: number; summary: string };
  tools: { bars: ToolBar[]; used: number; max: number; ticks: Marker[]; caption: string; live: boolean; summary: string };
  findings: { severity: SeverityCount[]; words: string; review: { confirmed: number; needsReview: number }; top: TopFinding[] };
}

export interface Dashboard {
  assessment: {
    uid: string;
    id: string;
    name: string;
    target: string;
    template: string;
    status: string;
    unfinished: boolean;
    progress: number;
    startedAt: string;
    duration: string;
    operator: string;
    scopeApproved: boolean;
    window: string | null;
  };
  operatorInitials: string;
  phases: PhaseView[];
  findingTotal: number;
  severity: SeverityCount[];
  checks: { total: number; allowed: number; blocked: number };
  maskedSecrets: number;
  requests: number;
  minutes: { used: number; max: number | null; over: boolean };
  planSteps: { done: number; total: number };
  scope: ScopeView | null;
  scopeCounts: { inScope: number; excluded: number };
  approvals: ApprovalView[];
  gate: { time: string; text: string } | null;
  findings: FindingRow[];
  log: LogLine[];
  window: { start: string; end: string };
  cards: OverviewCards;
}

// --- shared maps and helpers (derive-overall.ts uses them too) ---------------------------

export const SEV_TONE: Record<Severity, Tone> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "accent",
  LOW: "success",
  INFO: "dim",
};
const KIND_HEIGHT: Record<LogKind, number> = { info: 35, user: 45, mask: 40, scope: 50, policy: 55, tool: 70, finding: 90, gate: 100 };
const KIND_TONE: Record<LogKind, Tone> = {
  info: "primary",
  user: "primary",
  scope: "primary",
  policy: "primary",
  mask: "primary",
  tool: "primary",
  finding: "danger",
  gate: "accent",
};
// Lane heights cycle so neighbouring segments float at different levels.
export const LANE_FRAC = [0.3, 0.55, 0.22, 0.62, 0.42, 0.5, 0.36, 0.68];

export const initials = (name: string) =>
  name
    .split(/[.\s@_-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function findingIcon(f: FindingView): FindingIcon {
  const about = `${f.category} ${f.title}`;
  if (/secret|credential|password|database|data|exposure|redis/i.test(about)) return "database";
  if (/inject|xss|script|code|sql/i.test(about)) return "code";
  return "bug";
}

/** A finding as a list row; `run` set when the list spans several assessments. */
export function findingRow(f: FindingView, run: FindingRow["run"] = null): FindingRow {
  return { ...f, tone: SEV_TONE[f.severity], icon: findingIcon(f), key: run ? `${run.uid}~${f.id}` : f.id, run };
}

/** The Findings card: counts by severity, review state and the top CVSS scores. False
    positives are left out of every count. */
export function findingsSlice(rows: FindingRow[]): OverviewCards["findings"] {
  const counted = rows.filter((f) => !f.falsePositive);
  const total = counted.length;
  const severity = SEVERITIES.map((level) => {
    const count = counted.filter((f) => f.severity === level).length;
    return { level, count, share: total ? Math.round((count / total) * 100) : 0, tone: SEV_TONE[level] };
  });
  const top = counted
    .filter((f): f is FindingRow & { score: number } => f.score !== null && f.status !== "fixed")
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_FINDINGS)
    .map((f) => ({ key: f.key, id: f.id, title: f.title, severity: f.severity, score: f.score, icon: f.icon, run: f.run?.label ?? null }));
  return {
    severity,
    words: severity.map((s) => `${s.count} ${s.level.toLowerCase()}`).join(", "),
    review: { confirmed: counted.filter((f) => f.confirmed).length, needsReview: counted.filter((f) => f.needsReview).length },
    top,
  };
}

/** The "Findings" stat card: the total, the worst severity present, and a way into the list. */
export function findingsStat(severity: SeverityCount[]): StatCard {
  const total = severity.reduce((n, s) => n + s.count, 0);
  const top = severity.find((s) => s.count > 0) ?? null;
  return {
    label: "Findings",
    value: String(total),
    chip: top ? `${top.count} ${top.level.toLowerCase()}` : "none yet",
    tone: top && top.tone !== "dim" ? top.tone : "primary",
    link: { view: "findings", filters: {}, label: "Open all findings" },
  };
}

/** Markers at the first and last of `positions`; two close markers keep only the later label. */
export function bracketsAt(positions: number[], labelAt: (pos: number) => string): Marker[] {
  const at = [...new Set(positions.length ? [positions[0], positions[positions.length - 1]] : [])];
  return at.map((p, i) => ({ pos: p, label: i === 0 && at.length > 1 && at[1] - p < MIN_LABEL_GAP ? "" : labelAt(p) }));
}

export const toolCaption = (used: number, requests: number) =>
  `${used === 1 ? "tool step" : "tool steps"} · ${plural(requests, "request")} sent`;

export const litTicks = (pct: number) => Math.round((GAUGE_TICKS * pct) / 100);

/** The tool a TOOL log line is about: a tool from the approved scope if the line names one,
    else the line itself, shortened ("Executing baseline request" → "baseline request"). */
function toolLabel(text: string, tools: string[]): string {
  const named = tools.find((t) => text.toLowerCase().includes(t.toLowerCase()));
  if (named) return named;
  const part = text.split(" · ")[0].split(":")[0];
  const short = part.replace(/^(executing|running|continuing on)\s+/i, "").replace(/…$/, "");
  return short.length > 22 ? `${short.slice(0, 21)}…` : short;
}

// --- the dashboard -------------------------------------------------------------------------

export function deriveDashboard(v: AssessmentView): Dashboard {
  const pos = (sec: number) => Math.min(1, Math.max(0, sec / v.spanSec));
  const clockAt = (p: number) => clock(v.startMs + p * v.spanSec * 1000);
  const binOf = (sec: number) => Math.round(pos(sec) * (BINS - 1));
  const binPos = (i: number) => i / (BINS - 1);
  const log = v.log;

  // findings (false positives are left out of every count)
  const findings = v.findings.map((f) => findingRow(f));
  const findingCards = findingsSlice(findings);
  const severity = findingCards.severity;
  const findingTotal = severity.reduce((n, s) => n + s.count, 0);

  // run budget
  const windowLimit = v.scope ? v.scope.limits.find((l) => l.label === "Window")?.value ?? null : null;
  const usedMinutes = Math.round(v.durationSec / 60);
  const maxMinutes = v.scope ? v.scope.windowMinutes : null;
  const minutes = { used: usedMinutes, max: maxMinutes, over: maxMinutes !== null && usedMinutes > maxMinutes };
  const planSteps = { done: v.phases.filter((p) => p.status === "done").length, total: v.phases.length };

  // activity timeline: one bar per bin, its height from the most notable kind in it
  const activityBars: ActivityBar[] = Array.from({ length: BINS }, (_, i) => {
    const events = log.filter((l) => binOf(l.sec) === i);
    if (!events.length) return { pos: binPos(i), heightPct: 10, tone: "dim", title: clockAt(binPos(i)), hasEvent: false };
    const lead = events.reduce((a, b) => (KIND_HEIGHT[b.kind] > KIND_HEIGHT[a.kind] ? b : a));
    const more = events.length > 1 ? ` (+${events.length - 1} more)` : "";
    return {
      pos: binPos(i),
      heightPct: KIND_HEIGHT[lead.kind],
      tone: KIND_TONE[lead.kind],
      title: `${lead.t} · ${lead.kind} · ${lead.text}${more}`,
      hasEvent: true,
    };
  });
  const activityPeaks: Peak[] = log
    .filter((l) => l.kind === "finding" || l.kind === "gate")
    .map((l) => ({ pos: pos(l.sec), tone: KIND_TONE[l.kind], title: `${l.t} · ${l.text}` }));
  const lastPeakLine = [...log].reverse().find((l) => l.kind === "finding" || l.kind === "gate");
  const lastPeak = lastPeakLine ? { pos: pos(lastPeakLine.sec), label: lastPeakLine.t } : null;

  // execution timeline: scope check, policy blocks, tool segments and approval gates
  const tools = v.scope?.tools ?? [];
  const nextStop = (afterSec: number) =>
    log.find((l) => (l.kind === "tool" || l.kind === "gate") && l.sec > afterSec)?.sec ?? v.spanSec;
  const lastGate = [...log].reverse().find((l) => l.kind === "gate");
  const lanes: Lane[] = [];
  const firstScope = log.find((l) => l.kind === "scope");
  log.forEach((l, i) => {
    const key = `${i}`;
    const base = { key, start: pos(l.sec), end: pos(l.sec), pulse: false, title: `${l.t} · ${l.text}` };
    if (l === firstScope) lanes.push({ ...base, label: "scope", kind: "dot", tone: "primary" });
    else if (l.kind === "policy") lanes.push({ ...base, label: "policy block", kind: "dot", tone: "danger" });
    else if (l.kind === "tool") {
      const label = toolLabel(l.text, tools);
      const prev = lanes[lanes.length - 1];
      // the same tool again right after itself: one longer segment, not two
      if (prev && prev.kind === "segment" && prev.tone === "primary" && prev.label === label && prev.end >= base.start) prev.end = pos(nextStop(l.sec));
      else lanes.push({ ...base, label, kind: "segment", end: pos(nextStop(l.sec)), tone: "primary" });
    }
    else if (l.kind === "gate") {
      const pending = v.gate !== null && l === lastGate;
      lanes.push({ ...base, label: "gate", kind: pending ? "segment" : "dot", end: pending ? 1 : base.end, tone: "accent", pulse: pending });
    }
  });
  const executionLanes = thinLanes(lanes);
  const toolStarts = lanes.filter((l) => l.kind === "segment" && l.tone === "primary").map((l) => l.start);

  // tool activity: cumulative tool steps over the run
  const toolLines = log.filter((l) => l.kind === "tool");
  const toolBars = Array.from({ length: BINS }, (_, i) => ({
    pos: binPos(i),
    value: toolLines.filter((l) => binOf(l.sec) <= i).length,
    last: i === BINS - 1,
  }));

  const durationText = duration(v.durationSec);
  const statCards: StatCard[] = [
    findingsStat(severity),
    {
      label: "Policy checks",
      value: String(v.checks.total),
      chip: `${v.checks.allowed} allowed`,
      tone: "primary",
    },
    {
      label: "Blocked by policy",
      value: String(v.checks.blocked),
      chip: "not executed",
      tone: "accent",
    },
    { label: "Duration", value: durationText, chip: windowLimit ? `of ${windowLimit}` : "no time limit", tone: "primary", isDuration: true },
  ];

  const window = { start: clockAt(0), end: clockAt(1) };
  const laneLabels = executionLanes.map((l) => l.label);
  const scopeApproved = v.scope?.approved ?? false;
  const inScope = v.scope?.include.length ?? 0;
  const rings: Ring[] = [
    ...(maxMinutes !== null ? [{ used: minutes.used, max: maxMinutes, label: "Minutes", over: minutes.over }] : []),
    ...(planSteps.total > 0 ? [{ used: planSteps.done, max: planSteps.total, label: "Plan steps" }] : []),
  ];

  return {
    assessment: {
      uid: v.uid,
      id: v.id,
      name: v.name,
      target: v.target,
      template: v.template,
      status: v.status,
      unfinished: v.unfinished,
      progress: v.progress,
      startedAt: v.startedAt,
      duration: durationText,
      operator: v.operator,
      scopeApproved,
      window: windowLimit,
    },
    operatorInitials: initials(v.operator),
    phases: v.phases,
    findingTotal,
    severity,
    checks: v.checks,
    maskedSecrets: log.filter((l) => l.kind === "mask").length,
    requests: v.requests,
    minutes,
    planSteps,
    scope: v.scope,
    scopeCounts: { inScope, excluded: v.scope?.exclude.length ?? 0 },
    approvals: v.approvals,
    gate: v.gate,
    findings,
    log,
    window,
    cards: {
      activity: {
        bars: activityBars,
        peaks: activityPeaks,
        lastPeak,
        brackets: bracketsAt(toolStarts, clockAt),
        summary: `Activity timeline from ${window.start} to ${window.end}: ${plural(log.length, "log event")}.`,
        idle: "no findings or gates yet",
      },
      ask: {
        label: "Ask about this assessment",
        scope: { ok: scopeApproved, text: scopeApproved ? `Scope approved · ${v.operator}` : "Scope not approved yet" },
        reach: `${inScope} in scope`,
        questions: questionsFor(v, findingCards.top[0]?.id),
      },
      statCards,
      execution: {
        lanes: executionLanes,
        currentPos: v.gate && lastGate ? pos(lastGate.sec) : 1,
        ticks: log.length ? [0, 0.25, 0.5, 0.75].map((p) => ({ pos: p, label: clockAt(p) })) : [],
        rings,
        chip: windowLimit ? `Window ${windowLimit}` : "No time limit",
        summary: laneLabels.length
          ? `Execution timeline from ${window.start} to ${window.end}: ${laneLabels.join(", ")}.`
          : `Execution timeline from ${window.start}: no steps yet.`,
      },
      gauge: {
        value: v.progress,
        caption: `${v.status} · ${v.id}`,
        live: v.unfinished,
        ticks: GAUGE_TICKS,
        lit: litTicks(v.progress),
        summary: `Assessment progress ${v.progress}%, ${v.status.toLowerCase()}`,
      },
      tools: {
        bars: toolBars,
        used: toolLines.length,
        max: Math.max(1, toolLines.length),
        ticks: log.length ? [0, 0.5, 1].map((p) => ({ pos: p, label: clockAt(p) })) : [],
        caption: toolCaption(toolLines.length, v.requests),
        live: v.unfinished,
        summary: `Cumulative tool steps over the run, reaching ${toolLines.length}.`,
      },
      findings: findingCards,
    },
  };
}

/** At most MAX_LANES marks: the first scope check and pending marks always stay, the rest are
    sampled evenly across the axis so a long run (or many runs) still shows its whole shape. */
export function thinLanes(lanes: Lane[]): Lane[] {
  if (lanes.length <= MAX_LANES) return lanes;
  const keep = new Set<Lane>(lanes.filter((l) => l.pulse || l.label === "scope").slice(0, 2));
  const rest = lanes.filter((l) => !keep.has(l));
  const room = MAX_LANES - keep.size;
  for (let i = 0; i < room; i++) keep.add(rest[Math.round((i * (rest.length - 1)) / Math.max(1, room - 1))]);
  return lanes.filter((l) => keep.has(l));
}

/** Example questions for the Ask bar, about what this run actually holds. */
function questionsFor(v: AssessmentView, topFinding: string | undefined): string[] {
  const out: string[] = [];
  if (v.gate) out.push("What is this run waiting for?");
  if (topFinding) out.push(`Show the evidence for ${topFinding}`);
  if (v.checks.blocked) out.push("What did the policy block, and why?");
  if (v.findings.some((f) => f.needsReview)) out.push("Which findings still need review?");
  out.push(v.template !== "—" ? `Summarize this ${v.template} assessment` : "What happens after the target is set?");
  return out.slice(0, MAX_QUESTIONS);
}
