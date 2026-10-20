/**
 * Every number and chart series the dashboard shows, derived from one saved assessment
 * (src/lib/data/adapt.ts → AssessmentView). Components read numbers only from the Dashboard
 * this returns; none holds a literal number. If a design element needs a value the saved
 * assessment doesn't record, it does not go on the page.
 *
 * The Overview reads only `cards` (OverviewCards, overview-types.ts): derive-overall.ts makes
 * the same shape from every saved run at once, so one set of components draws either.
 *
 * Runs on the server (src/app/page.tsx) and hands plain data to the views, so every label,
 * including clock times, is computed once, here. Log text is masked again here
 * (lib/assistant/redact.ts) on top of what the TUI's snapshot already masked. Positions on the
 * time axis are fractions (0 = the run's first log line, 1 = its last).
 */
import { redact } from "@/lib/assistant/redact";
import { clock, duration, hourMinute, minutesLimit, shortDay, stamp } from "@/lib/data/format";
import { SEVERITIES } from "@/lib/data/schema";
import type { ApprovalView, AssessmentView, FindingView, LogLine, PhaseView, ScopeView, Severity } from "@/lib/data/view-types";
import { APPROVAL_STATE, RUN_STATUS, STEP_STATUS, toneColor } from "@/lib/status";

import { cluster, mergeNarrow, type Segment, segmentLabel, ticksAt } from "./axis";
import { EVENT_KIND, eventBadge, eventLabel, LANE_ORDER, toolLabel, toolsNamed } from "./event-kinds";
import type {
  ActivityCard,
  ActivityEvent,
  ActivityLane,
  ExecutionCard,
  FindingsSlice,
  LegendItem,
  OverviewCards,
  RunEntry,
  SummaryStrip,
  ToolSegment,
} from "./overview-types";

export type * from "./overview-types";

/** The assessment templates the TUI offers (the Template chip lists them). */
export const TEMPLATES = ["Network", "API", "Source Code", "Web URL"] as const;

export const MAX_QUESTIONS = 3;
const TOP_FINDINGS = 8; // the card shows as many as its height allows (3 at least)
const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1];

export type FindingIcon = "bug" | "code" | "database";
/** A finding as listed: `key` is unique in the list (the ID for one run, `<uid>~<ID>` across
    runs) and `run` names the assessment it came from when the list spans several. */
export type FindingRow = FindingView & { icon: FindingIcon; key: string; run: { uid: string; label: string } | null };

export interface Dashboard {
  assessment: {
    uid: string;
    id: string;
    name: string;
    target: string;
    template: string;
    status: AssessmentView["status"];
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
  severity: FindingsSlice["severity"];
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
  cards: OverviewCards;
}

// --- shared helpers (derive-overall.ts uses them too) ------------------------------------

export const initials = (name: string) =>
  name
    .split(/[.\s@_-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function findingIcon(f: FindingView): FindingIcon {
  const about = `${f.category} ${f.title}`;
  if (/secret|credential|password|database|data|exposure|redis/i.test(about)) return "database";
  if (/inject|xss|script|code|sql/i.test(about)) return "code";
  return "bug";
}

/** A finding as a list row; `run` set when the list spans several assessments. */
export function findingRow(f: FindingView, run: FindingRow["run"] = null): FindingRow {
  return { ...f, icon: findingIcon(f), key: run ? `${run.uid}~${f.id}` : f.id, run };
}

/** Findings by Severity: counts and shares by severity, review state and the top CVSS
    scores. False positives are left out of every count. */
export function findingsSlice(rows: FindingRow[]): FindingsSlice {
  const counted = rows.filter((f) => !f.falsePositive);
  const total = counted.length;
  const severity = SEVERITIES.map((level) => {
    const count = counted.filter((f) => f.severity === level).length;
    return { level, count, share: total ? Math.round((count / total) * 100) : 0, frac: total ? count / total : 0 };
  });
  const top = counted
    .filter((f): f is FindingRow & { score: number } => f.score !== null && f.status !== "fixed")
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_FINDINGS)
    .map((f) => ({ key: f.key, id: f.id, title: f.title, severity: f.severity, score: f.score, run: f.run?.label ?? null }));
  const confirmed = counted.filter((f) => f.confirmed).length;
  const needsReview = counted.filter((f) => f.needsReview).length;
  return {
    total,
    severity,
    words: severity.map((s) => `${s.count} ${s.level.toLowerCase()}`).join(", "),
    review: { confirmed, needsReview, closed: total - confirmed - needsReview },
    top,
  };
}

/** The summary strip's Findings card: the total and the worst severity present. */
export function findingsSummary(slice: FindingsSlice): SummaryStrip["findings"] {
  const worst = slice.severity.find((s) => s.count > 0) ?? null;
  return {
    total: slice.total,
    worst: worst ? { level: worst.level, count: worst.count } : null,
    needsReview: slice.review.needsReview,
    link: { view: "findings", filters: {}, label: "Open all findings" },
  };
}

/** The "requests sent" part of the Tool execution card. */
export const toolCaption = (requests: number) => `${plural(requests, "request")} sent by the tools`;

/** A saved run as a row: the execution rows (every run) and a day's runs. */
export function runEntry(v: AssessmentView): RunEntry {
  return {
    uid: v.uid,
    id: v.id,
    template: v.template,
    time: hourMinute(v.createdMs),
    when: `${shortDay(v.createdMs)} ${hourMinute(v.createdMs)}`,
    status: v.status,
    progress: v.progress,
    steps: { done: v.phases.filter((p) => p.status === "done").length, total: v.phases.length },
    findings: v.findings.filter((f) => !f.falsePositive).length,
    target: redact(v.target),
    waiting: v.gate ? redact(v.gate.text) : "",
  };
}

/** Legend entries for the plan step states. */
const STEP_LEGEND: LegendItem[] = (["done", "active", "pending"] as const).map((s) => ({
  label: STEP_STATUS[s].label,
  color: toneColor(STEP_STATUS[s].tone),
  hint: STEP_STATUS[s].hint,
  shape: "bar",
}));

// --- the activity timeline (one run) ---------------------------------------------------

function activityCard(v: AssessmentView, pos: (sec: number) => number, labelAt: (p: number) => string): ActivityCard {
  const log = v.log;
  const tools = v.scope?.tools ?? [];
  const lastGate = [...log].reverse().find((l) => l.kind === "gate");
  const lastTool = [...log].reverse().find((l) => l.kind === "tool");
  const severityOf = (id: string): Severity | undefined => v.findings.find((f) => f.id === id)?.severity;
  const event = (l: LogLine, i: number): ActivityEvent => {
    const ms = v.startMs + l.sec * 1000;
    return {
      key: String(i),
      time: l.t,
      when: l.t === "—" ? "time not recorded" : stamp(ms),
      kind: l.kind,
      label: redact(eventLabel(l.kind, l.text, tools)),
      badge: eventBadge(l.kind, l.text, {
        who: l.who,
        pendingGate: v.gate !== null && l === lastGate,
        liveTool: v.status === "Running" && l === lastTool,
        severityOf,
      }),
      text: redact(l.text),
    };
  };
  const events = log.map((l, i) => ({ line: l, event: event(l, i) }));
  const lanes: ActivityLane[] = LANE_ORDER.map((kind) => {
    const here = events.filter((e) => e.line.kind === kind);
    const groups = cluster(here.map((e) => ({ pos: pos(e.line.sec), item: e })));
    const meaning = EVENT_KIND[kind];
    return {
      kind,
      label: meaning.label,
      hint: meaning.hint,
      color: toneColor(meaning.tone),
      count: here.length,
      marks: groups.map((g) => {
        const first = g.items[0].event;
        const last = g.items[g.items.length - 1].event;
        const span = g.items.length > 1 && first.time !== last.time ? `${first.time}–${last.time}` : first.time;
        return {
          key: `${kind}-${first.key}`,
          start: g.start,
          end: g.end,
          count: g.items.length,
          pending: g.items.some((e) => e.event.badge.type === "status" && e.event.badge.meaning === APPROVAL_STATE.PENDING),
          title: g.items.length > 1 ? `${span} · ${g.items.length} ${meaning.label.toLowerCase()} events` : `${span} · ${first.label}`,
          events: g.items.map((e) => e.event),
        };
      }),
    };
  });
  const start = labelAt(0);
  const end = labelAt(1);
  const pending = lanes.some((l) => l.marks.some((m) => m.pending));
  return {
    mode: "events",
    lanes,
    ticks: log.length ? ticksAt(AXIS_TICKS, labelAt) : [],
    total: log.length,
    window: log.length ? `${start} → ${end} · ${duration(v.spanSec)}` : "No activity yet",
    summary: `Activity timeline from ${start} to ${end}: ${plural(log.length, "log event")} in ${lanes.filter((l) => l.count).length} kinds.`,
    legend: [
      { label: "One event", color: "var(--muted-foreground)", hint: "A single log line.", shape: "dot" },
      { label: "Events close together", color: "var(--muted-foreground)", hint: "Several lines too close to draw apart; the number counts them.", shape: "count" },
      ...(pending ? [{ label: "Waits on you", color: toneColor(APPROVAL_STATE.PENDING.tone), hint: APPROVAL_STATE.PENDING.hint, shape: "ring" as const }] : []),
    ],
    empty: log.length ? null : "Nothing logged yet: the timeline fills in as the run goes.",
  };
}

// --- the execution timeline (one run) --------------------------------------------------

function executionCard(v: AssessmentView, pos: (sec: number) => number, labelAt: (p: number) => string): ExecutionCard {
  const log = v.log;
  const tools = v.scope?.tools ?? [];
  const nextStop = (afterSec: number) => log.find((l) => (l.kind === "tool" || l.kind === "gate") && l.sec > afterSec)?.sec ?? v.spanSec;
  // tool steps as segments that last until the next tool step or gate; the same tool again
  // right after itself extends its segment
  const segments: Segment[] = [];
  log.forEach((l, i) => {
    if (l.kind !== "tool") return;
    const label = toolLabel(l.text, tools);
    const prev = segments[segments.length - 1];
    const start = pos(l.sec);
    if (prev && prev.tools.length === 1 && prev.tools[0] === label && prev.end >= start) {
      prev.end = pos(nextStop(l.sec));
      prev.steps += 1;
      prev.times.push(l.t);
    } else segments.push({ key: String(i), tools: [label], start, end: pos(nextStop(l.sec)), steps: 1, times: [l.t] });
  });
  const live = v.status === "Running";
  const shown = mergeNarrow(segments);
  const toolSegments: ToolSegment[] = shown.map((s, i) => ({
    key: s.key,
    label: redact(segmentLabel(s.tools)),
    start: s.start,
    end: Math.max(s.end, s.start),
    steps: s.steps,
    title: redact(`${segmentLabel(s.tools)} · ${s.times[0]}${s.steps > 1 ? `–${s.times[s.times.length - 1]} · ${s.steps} steps` : ""}`),
    live: live && i === shown.length - 1,
  }));
  const lastGate = [...log].reverse().find((l) => l.kind === "gate");
  const approval = v.approvals.find((a) => a.state === "PENDING");
  const gate = v.gate
    ? {
        pos: lastGate ? pos(lastGate.sec) : null,
        time: v.gate.time,
        text: redact(v.gate.text),
        meaning: approval ? APPROVAL_STATE.PENDING : RUN_STATUS["Awaiting input"],
      }
    : null;
  const done = v.phases.filter((p) => p.status === "done").length;
  return {
    mode: "phases",
    phases: v.phases,
    tools: toolSegments,
    ticks: log.length ? ticksAt(AXIS_TICKS, labelAt) : [],
    gate,
    caption: v.phases.length ? `${done} of ${plural(v.phases.length, "plan step")} done` : "No plan yet",
    summary: v.phases.length
      ? `Execution: ${v.phases.map((p) => `${p.label} ${STEP_STATUS[p.status].label.toLowerCase()} ${p.pct}%`).join(", ")}; ${plural(toolSegments.length, "tool segment")}.`
      : "Execution: no plan yet.",
    legend: [
      ...STEP_LEGEND.filter((item) => v.phases.some((p) => STEP_STATUS[p.status].label === item.label)),
      { label: "Tool step", color: toneColor(EVENT_KIND.tool.tone), hint: EVENT_KIND.tool.hint, shape: "bar" },
      ...(gate ? [{ label: gate.meaning.label, color: toneColor(gate.meaning.tone), hint: gate.meaning.hint, shape: "diamond" as const }] : []),
    ],
  };
}

// --- the dashboard -------------------------------------------------------------------------

export function deriveDashboard(v: AssessmentView): Dashboard {
  const pos = (sec: number) => Math.min(1, Math.max(0, sec / v.spanSec));
  const clockAt = (p: number) => clock(v.startMs + p * v.spanSec * 1000);
  // a run of ten minutes or more is labelled in minutes ("14:03"), a short one in seconds
  const labelAt = (p: number) => (v.spanSec >= 600 ? hourMinute(v.startMs + p * v.spanSec * 1000) : clockAt(p));
  const log = v.log;

  // findings (false positives are left out of every count)
  const findings = v.findings.map((f) => findingRow(f));
  const findingCards = findingsSlice(findings);

  // run budget
  const windowLimit = v.scope ? minutesLimit(v.scope.windowMinutes) : null;
  const usedMinutes = Math.round(v.durationSec / 60);
  const maxMinutes = v.scope ? v.scope.windowMinutes : null;
  const over = maxMinutes !== null && v.durationSec > maxMinutes * 60;
  const minutes = { used: usedMinutes, max: maxMinutes, over };
  const planSteps = { done: v.phases.filter((p) => p.status === "done").length, total: v.phases.length };

  const toolLines = log.filter((l) => l.kind === "tool");
  const tools = v.scope?.tools ?? [];
  const durationText = duration(v.durationSec);
  const summary: SummaryStrip = {
    findings: findingsSummary(findingCards),
    progress: {
      pct: v.progress,
      caption: planSteps.total ? `${planSteps.done} of ${plural(planSteps.total, "plan step")} done` : "No plan yet",
      status: v.status,
      other: null,
    },
    tools: {
      steps: toolLines.length,
      tools: toolsNamed(toolLines.map((l) => l.text), tools),
      requests: v.requests,
      running: v.status === "Running",
      caption: toolCaption(v.requests),
    },
    duration: {
      value: durationText,
      countup: true,
      caption: windowLimit ? `of the ${windowLimit} limit` : "no time limit",
      meter: maxMinutes ? { frac: Math.min(1, v.durationSec / (maxMinutes * 60)), over } : null,
      over: over ? 1 : 0,
    },
  };

  const scopeApproved = v.scope?.approved ?? false;
  const inScope = v.scope?.include.length ?? 0;

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
    findingTotal: findingCards.total,
    severity: findingCards.severity,
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
    cards: {
      mode: "run",
      summary,
      ask: {
        label: "Ask about this assessment",
        scope: { ok: scopeApproved, text: scopeApproved ? `Scope approved · ${v.operator}` : "Scope not approved yet" },
        reach: `${inScope} in scope`,
        questions: questionsFor(v, findingCards.top[0]?.id),
      },
      activity: activityCard(v, pos, labelAt),
      execution: executionCard(v, pos, labelAt),
      findings: findingCards,
    },
  };
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
