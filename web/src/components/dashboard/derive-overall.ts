/**
 * The Overview for every saved assessment at once (the default: no `?uid=`). It makes the same
 * card data as deriveDashboard (OverviewCards), totalled over all runs, plus the counts the top
 * bar shows. Pure, like derive.ts: no I/O, no invented numbers.
 *
 * The time axis runs from the first saved run to the last (at least an hour wide); each run
 * sits at the time it was created. Position 0 is the oldest run, 1 the newest.
 */
import { hourMinute, shortDay } from "@/lib/data/format";
import { STATUSES } from "@/lib/data/schema";
import type { AssessmentView, Tone } from "@/lib/data/view-types";

import {
  type ActivityBar,
  BINS,
  bracketsAt,
  type FindingRow,
  findingRow,
  findingsSlice,
  findingsStat,
  GAUGE_TICKS,
  initials,
  type Lane,
  litTicks,
  MAX_QUESTIONS,
  type Marker,
  type OverviewCards,
  type Peak,
  type Ring,
  type StatCard,
  thinLanes,
  toolCaption,
} from "./derive";

const HOUR = 3_600_000;
const MIN_SPAN = HOUR; // one run (or runs minutes apart) still gets a readable axis
const DAY_LABELS_AFTER = 36 * HOUR; // a wider axis is labelled with days, not clock times

export type CountRow = { name: string; count: number };

export interface Overall {
  runs: number;
  waiting: number;
  completed: number;
  findingTotal: number;
  operator: string; // the newest run's operator
  operators: string[];
  operatorInitials: string;
  targets: CountRow[];
  templates: CountRow[];
  statuses: CountRow[];
  findings: FindingRow[]; // every run's findings, newest run first
  cards: OverviewCards;
}

/** How many runs share each value, most common first (ties keep first-seen order). */
function countRows(values: string[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Labels for evenly placed ticks, dropping one that repeats its neighbour ("5 Oct", "5 Oct"). */
function ticksAt(positions: number[], labelAt: (pos: number) => string): Marker[] {
  const ticks = positions.map((pos) => ({ pos, label: labelAt(pos) }));
  return ticks.filter((t, i) => i === 0 || t.label !== ticks[i - 1].label);
}

/** Every saved run's Overview. `views` is the library (newest first); it must not be empty. */
export function deriveOverall(views: AssessmentView[]): Overall {
  const n = views.length;
  const oldestFirst = [...views].sort((a, b) => a.createdMs - b.createdMs);
  const first = oldestFirst[0].createdMs;
  const last = oldestFirst[n - 1].createdMs;
  const span = Math.max(last - first, MIN_SPAN);
  const t0 = first - (span - (last - first)) / 2; // a narrow set of runs sits in the middle
  const pos = (ms: number) => Math.min(1, Math.max(0, (ms - t0) / span));
  const labelAt = (p: number) => {
    const ms = t0 + p * span;
    return span > DAY_LABELS_AFTER ? shortDay(ms) : hourMinute(ms);
  };
  const when = (ms: number) => `${shortDay(ms)} ${hourMinute(ms)}`;
  const binOf = (ms: number) => Math.round(pos(ms) * (BINS - 1));
  const binPos = (i: number) => i / (BINS - 1);

  // what each run adds, oldest first along the axis
  const runs = oldestFirst.map((v) => {
    const real = v.findings.filter((f) => !f.falsePositive);
    return {
      v,
      at: pos(v.createdMs),
      bin: binOf(v.createdMs),
      when: when(v.createdMs),
      real: real.length,
      severe: real.some((f) => f.severity === "CRITICAL" || f.severity === "HIGH"),
      waiting: v.status === "Awaiting input",
      tools: v.log.filter((l) => l.kind === "tool").length,
    };
  });
  const waiting = runs.filter((r) => r.waiting).length;
  const completed = views.filter((v) => v.status === "Completed").length;
  const live = views.some((v) => v.unfinished);

  // findings across runs (each keyed by its run)
  const findings = views.flatMap((v) => v.findings.map((f) => findingRow(f, { uid: v.uid, label: `${v.id} · ${when(v.createdMs)}` })));
  const findingCards = findingsSlice(findings);
  const findingTotal = findingCards.severity.reduce((s, x) => s + x.count, 0);

  // activity: runs started per slot (taller = more runs); amber = waits on you, red = high risk
  const perBin = Array.from({ length: BINS }, (_, i) => runs.filter((r) => r.bin === i));
  const busiest = Math.max(1, ...perBin.map((b) => b.length));
  const bars: ActivityBar[] = perBin.map((here, i) => {
    if (!here.length) return { pos: binPos(i), heightPct: 10, tone: "dim", title: labelAt(binPos(i)), hasEvent: false };
    const tone: Tone = here.some((r) => r.waiting) ? "accent" : here.some((r) => r.severe) ? "danger" : "primary";
    const ids = here.slice(0, 3).map((r) => r.v.id).join(", ") + (here.length > 3 ? ` +${here.length - 3}` : "");
    const runsWord = here.length === 1 ? "1 run" : `${here.length} runs`;
    return { pos: binPos(i), heightPct: Math.round(35 + (65 * here.length) / busiest), tone, title: `${here[0].when} · ${runsWord} · ${ids}`, hasEvent: true };
  });
  const peaks: Peak[] = runs.flatMap((r) => [
    ...(r.real ? [{ pos: r.at, tone: "danger" as Tone, title: `${r.v.id} · ${r.when} · ${r.real === 1 ? "1 finding" : `${r.real} findings`}` }] : []),
    ...(r.waiting ? [{ pos: r.at, tone: "accent" as Tone, title: `${r.v.id} · ${r.when} · waits on you` }] : []),
  ]);
  const lastNotable = [...runs].reverse().find((r) => r.real || r.waiting);

  // execution: one mark per run; one still going runs on to now (amber and pulsing if it waits)
  const lanes: Lane[] = runs.map((r) => ({
    key: r.v.uid,
    label: `${r.v.id} · ${r.v.template}`,
    kind: r.v.unfinished ? "segment" : "dot",
    start: r.at,
    end: r.v.unfinished ? 1 : r.at,
    tone: r.waiting ? "accent" : r.v.status === "Completed" || r.v.unfinished ? "primary" : "dim",
    pulse: r.waiting,
    title: `${r.when} · ${r.v.status}${r.real ? ` · ${r.real === 1 ? "1 finding" : `${r.real} findings`}` : ""}`,
  }));
  const phasesDone = views.reduce((s, v) => s + v.phases.filter((p) => p.status === "done").length, 0);
  const phasesTotal = views.reduce((s, v) => s + v.phases.length, 0);
  const rings: Ring[] = [
    { used: completed, max: n, label: "Runs completed" },
    ...(phasesTotal > 0 ? [{ used: phasesDone, max: phasesTotal, label: "Plan steps" }] : []),
  ];
  const sameDay = shortDay(first) === shortDay(last);
  const chip = sameDay
    ? `${shortDay(first)} ${hourMinute(first)}${n > 1 && hourMinute(first) !== hourMinute(last) ? `–${hourMinute(last)}` : ""}`
    : `${shortDay(first)} → ${shortDay(last)}`;

  // tool steps over time, every run
  const toolTotal = runs.reduce((s, r) => s + r.tools, 0);
  const requests = views.reduce((s, v) => s + v.requests, 0);
  const toolBars = Array.from({ length: BINS }, (_, i) => ({
    pos: binPos(i),
    value: runs.filter((r) => r.bin <= i).reduce((s, r) => s + r.tools, 0),
    last: i === BINS - 1,
  }));

  // policy
  const checks = views.reduce((s, v) => s + v.checks.total, 0);
  const allowed = views.reduce((s, v) => s + v.checks.allowed, 0);
  const blocked = views.reduce((s, v) => s + v.checks.blocked, 0);
  const statCards: StatCard[] = [
    findingsStat(findingCards.severity),
    { label: "Policy checks", value: String(checks), chip: `${allowed} allowed`, tone: "primary" },
    { label: "Blocked by policy", value: String(blocked), chip: "not executed", tone: "accent" },
    {
      label: "Assessments",
      value: String(n),
      chip: waiting ? `${waiting} waiting` : `${completed} completed`,
      tone: waiting ? "accent" : "primary",
    },
  ];

  const approvedScopes = views.filter((v) => v.scope?.approved).length;
  const targets = countRows(views.map((v) => v.target || "—"));
  const operators = [...new Set(views.map((v) => v.operator).filter((o) => o && o !== "—"))];
  const operator = operators[0] ?? "—";
  const value = Math.round((completed / n) * 100);
  const start = labelAt(0);
  const end = labelAt(1);

  return {
    runs: n,
    waiting,
    completed,
    findingTotal,
    operator,
    operators,
    operatorInitials: initials(operator),
    targets,
    templates: countRows(views.map((v) => v.template)),
    statuses: STATUSES.map((s) => ({ name: s, count: views.filter((v) => v.status === s).length })).filter((s) => s.count > 0),
    findings,
    cards: {
      activity: {
        bars,
        peaks,
        lastPeak: lastNotable ? { pos: lastNotable.at, label: lastNotable.when } : null,
        brackets: bracketsAt(runs.map((r) => r.at), labelAt),
        summary: `Assessments started from ${start} to ${end}: ${n === 1 ? "1 run" : `${n} runs`}.`,
        idle: "no findings yet",
      },
      ask: {
        label: "Ask about your assessments",
        scope: {
          ok: approvedScopes === n,
          text: approvedScopes === n ? "Every scope approved" : `${approvedScopes} of ${n} scopes approved`,
        },
        reach: targets.length === 1 ? "1 target" : `${targets.length} targets`,
        questions: overallQuestions({ n, waiting, blocked, severe: runs.some((r) => r.severe), review: findingCards.review.needsReview }),
      },
      statCards,
      execution: {
        lanes: thinLanes(lanes),
        currentPos: runs[n - 1].at,
        ticks: ticksAt([0, 0.25, 0.5, 0.75], labelAt),
        rings,
        chip,
        summary: `Assessments from ${start} to ${end}: ${n} runs, ${completed} completed, ${waiting} waiting.`,
      },
      gauge: {
        value,
        caption: `${completed} of ${n} completed`,
        live,
        ticks: GAUGE_TICKS,
        lit: litTicks(value),
        summary: `${value}% of ${n} assessments completed`,
      },
      tools: {
        bars: toolBars,
        used: toolTotal,
        max: Math.max(1, toolTotal),
        ticks: ticksAt([0, 0.5, 1], labelAt),
        caption: toolCaption(toolTotal, requests),
        live,
        summary: `Tool steps across ${n} assessments, reaching ${toolTotal}.`,
      },
      findings: findingCards,
    },
  };
}

/** Example questions for the Ask bar, about what the saved runs hold. */
function overallQuestions(s: { n: number; waiting: number; blocked: number; severe: boolean; review: number }): string[] {
  const out: string[] = [];
  if (s.waiting) out.push("Which assessments are waiting on me?");
  if (s.severe) out.push("Which runs found high-risk issues?");
  if (s.blocked) out.push("What did the policy block across runs?");
  if (s.review) out.push("Which findings still need review?");
  out.push(s.n > 1 ? "Compare my last two assessments" : "Summarize this assessment");
  return out.slice(0, MAX_QUESTIONS);
}
