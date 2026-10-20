/**
 * The Scope view (ScopeCards, scope-types.ts) for one saved run or for every saved run at once.
 * Pure, like derive.ts: every number counts what the saved files hold, nothing is invented, and
 * text taken from targets and tools is masked again (lib/assistant/redact.ts).
 *
 * One run: its boundary (target, ports, exclusions), its approval requests in plan order, its
 * permitted actions and tools, and its limits with the time used. Every run: the targets tested
 * (each with its runs), the approval requests across runs (waiting ones first), and the actions,
 * tools and limits the scopes allowed, with in how many runs each appears.
 */
import { redact } from "@/lib/assistant/redact";
import { duration, minutesLimit } from "@/lib/data/format";
import type { ApprovalState, ApprovalView, AssessmentView } from "@/lib/data/view-types";
import { APPROVAL_STATE, type Meaning, riskMeaning, SCOPE_STATE, scopeMeaning, TIME_LIMIT } from "@/lib/status";

import { countChips, plural, runLink, statusBadge } from "./derive-shared";
import type { ApprovalRow, ScopeCards, TargetRow } from "./scope-types";
import type { EventBadge } from "./overview-types";
import type { RunLink, Stat } from "./stat-types";

export const MAX_APPROVALS = 8; // rows across runs; each run's own Scope lists all of its own

/** Waiting ones first: they are what the operator has to act on. */
const STATE_ORDER: ApprovalState[] = ["PENDING", "REJECTED", "APPROVED", "NOT REACHED"];
const STATE_WORD: Record<ApprovalState, string> = { PENDING: "waiting", REJECTED: "rejected", APPROVED: "approved", "NOT REACHED": "not reached" };

/** One badge per approval state present, in its own words ("2 waiting"). */
export function approvalBadges(approvals: Pick<ApprovalView, "state">[]): EventBadge[] {
  return STATE_ORDER.map((s) => ({ s, n: approvals.filter((a) => a.state === s).length }))
    .filter(({ n }) => n > 0)
    .map(({ s, n }) => statusBadge(APPROVAL_STATE[s], `${n} ${STATE_WORD[s]}`));
}

function approvalRow(a: ApprovalView, run: RunLink | null): ApprovalRow {
  return {
    key: run ? `${run.uid}~${a.id}` : a.id,
    action: redact(a.action),
    target: redact(a.target),
    risk: riskMeaning(a.risk),
    state: APPROVAL_STATE[a.state],
    run,
  };
}

const stat = (s: Partial<Stat> & Pick<Stat, "label" | "icon" | "value" | "note">): Stat => ({
  format: "int",
  unit: null,
  badges: [],
  meter: null,
  link: null,
  ...s,
});

const overLimit = (v: AssessmentView) => v.scope !== null && v.scope.windowMinutes > 0 && v.durationSec > v.scope.windowMinutes * 60;

// --- one run -------------------------------------------------------------------------------

export function scopeCards(v: AssessmentView): ScopeCards {
  const s = v.scope;
  const approvals = v.approvals.map((a) => approvalRow(a, null));
  const approvalBlock = {
    rows: approvals,
    more: 0,
    meta: plural(approvals.length, "request"),
    empty: "No gated actions in this plan: nothing here asks for your approval.",
  };
  if (!s) {
    return {
      mode: "run",
      tag: `${v.id} · ${redact(v.target)}`,
      about: "No Scope Manifest yet.",
      empty: SCOPE_STATE.none.hint,
      stats: [],
      boundary: { mode: "run", target: redact(v.target), state: SCOPE_STATE.none, ports: [], exclude: [] },
      approvals: approvalBlock,
      permitted: { actions: [], tools: [] },
      limits: { rows: [], usage: null },
    };
  }

  const state = scopeMeaning(s.status);
  const target = redact(s.target);
  const exclude = s.exclude.map(redact);
  const window = s.windowMinutes > 0 ? s.windowMinutes : null;
  const over = overLimit(v);
  const used = duration(v.durationSec);
  return {
    mode: "run",
    tag: `${v.id} · ${target}`,
    about: s.approved
      ? `The boundary ${v.operator} approved for ${v.id}: testing stays inside it.`
      : `The Scope Manifest of ${v.id} is not approved yet: testing waits until the operator approves it in the TUI.`,
    empty: null,
    stats: [
      stat({
        label: "In scope",
        icon: "target",
        value: String(s.include.length),
        badges: [{ type: "status", meaning: state }],
        note: `${target} · ${s.ports.length ? plural(s.ports.length, "port") : "default ports"}`,
      }),
      stat({
        label: "Excluded",
        icon: "excluded",
        value: String(exclude.length),
        note: exclude.length ? `${exclude[0]}${exclude.length > 1 ? ` and ${exclude.length - 1} more` : ""}` : "Nothing excluded",
      }),
      stat({
        label: "Approvals",
        icon: "approvals",
        value: String(approvals.length),
        badges: approvalBadges(v.approvals),
        note: approvals.length ? "risky steps that ask you first" : "No gated actions in this plan",
      }),
      stat({
        label: "Time window",
        icon: "clock",
        value: window ? minutesLimit(window) : "No limit",
        format: "none",
        badges: over ? [{ type: "status", meaning: TIME_LIMIT.over }] : [],
        meter: window ? { frac: Math.min(1, v.durationSec / (window * 60)), over, label: "Time used of the window" } : null,
        note: `${used} used`,
      }),
    ],
    boundary: { mode: "run", target, state, ports: s.ports, exclude },
    approvals: approvalBlock,
    permitted: {
      actions: s.actions.map((a) => ({ label: a, count: null, title: `Permitted: ${a}` })),
      tools: s.tools.map((t) => ({ label: t, count: null, title: `Approved tool: ${t}` })),
    },
    limits: {
      rows: [
        { label: "Methods", chips: s.methods.map((m) => ({ label: m, count: null, title: `Allowed method: ${m}` })) },
        { label: "Window", chips: window ? [{ label: minutesLimit(window), count: null, title: "The run's time limit" }] : [] },
      ],
      usage: window ? { frac: Math.min(1, v.durationSec / (window * 60)), over, caption: `${used} used of ${minutesLimit(window)}` } : null,
    },
  };
}

// --- every run -----------------------------------------------------------------------------

/** How many of a target's runs had their scope approved, as a badge. */
function targetScope(approved: number, runs: number): Meaning {
  if (approved === runs) return { ...SCOPE_STATE.approved, label: runs === 1 ? "Approved" : `All ${runs} approved` };
  if (approved === 0) return SCOPE_STATE.draft;
  return { ...SCOPE_STATE.draft, label: `${approved} of ${runs} approved`, hint: "Some of these runs' scopes were approved in the TUI, not all." };
}

/** Every target tested, with its runs; the most tested first (ties: the newest first). */
export function targetRows(views: AssessmentView[]): TargetRow[] {
  const groups = new Map<string, AssessmentView[]>();
  for (const v of views) groups.set(v.target || "—", [...(groups.get(v.target || "—") ?? []), v]);
  const newestOf = (runs: AssessmentView[]) => runs.reduce((a, b) => (b.createdMs > a.createdMs ? b : a));
  return [...groups.entries()]
    .sort(([, a], [, b]) => b.length - a.length || newestOf(b).createdMs - newestOf(a).createdMs)
    .map(([target, runs]) => {
      const newest = newestOf(runs);
      const ports = [...new Set(runs.flatMap((r) => r.scope?.ports ?? []))].sort((a, b) => Number(a) - Number(b));
      const approved = runs.filter((r) => r.scope?.approved).length;
      return {
        target: redact(target),
        runs: runs.length,
        ports,
        excluded: new Set(runs.flatMap((r) => r.scope?.exclude ?? [])).size,
        scope: targetScope(approved, runs.length),
        latest: { ...runLink(newest), status: newest.status },
      };
    });
}

/** `views` is the library (newest first); it must not be empty. */
export function overallScopeCards(views: AssessmentView[]): ScopeCards {
  const n = views.length;
  const scoped = views.filter((v) => v.scope !== null);
  const approved = scoped.filter((v) => v.scope!.approved).length;
  const drafts = scoped.length - approved;
  const unscoped = n - scoped.length;
  const targets = targetRows(views);
  const all = views.flatMap((v) => v.approvals.map((a) => ({ a, run: runLink(v) })));
  const rows = STATE_ORDER.flatMap((s) => all.filter(({ a }) => a.state === s)).map(({ a, run }) => approvalRow(a, run));
  const withApprovals = views.filter((v) => v.approvals.length > 0).length;
  const timed = scoped.filter((v) => v.scope!.windowMinutes > 0);
  const over = timed.filter(overLimit).length;
  const top = targets[0];

  const scopeBadges: EventBadge[] = [];
  if (drafts) scopeBadges.push(statusBadge(SCOPE_STATE.draft, `${drafts} not approved`));
  if (unscoped) scopeBadges.push(statusBadge(SCOPE_STATE.none, `${unscoped} without a scope`));

  return {
    mode: "all",
    tag: `All ${plural(n, "run")}`,
    about: `${approved} of ${plural(n, "saved run")} had their scope approved. Open a target or a request for that run's own scope.`,
    empty: null,
    stats: [
      stat({
        label: "Targets",
        icon: "target",
        value: String(targets.length),
        note: `${top.target} most often · ${plural(top.runs, "run")}`,
      }),
      stat({
        label: "Scopes approved",
        icon: "scopes",
        value: `${approved}/${n}`,
        format: "none",
        badges: scopeBadges,
        meter: { frac: approved / n, over: false, label: "Runs with an approved scope" },
        note: approved === n ? "Every run's scope was approved" : "approved by the operator in the TUI",
      }),
      stat({
        label: "Approvals",
        icon: "approvals",
        value: String(all.length),
        badges: approvalBadges(all.map(({ a }) => a)),
        note: all.length ? `gated actions in ${plural(withApprovals, "run")}` : "No gated actions in any plan",
      }),
      stat({
        label: "Time window",
        icon: "clock",
        value: `${timed.length - over}/${timed.length}`,
        format: "none",
        badges: over ? [statusBadge(TIME_LIMIT.over, `${over} over the limit`)] : [],
        meter: timed.length ? { frac: (timed.length - over) / timed.length, over: false, label: "Runs within their time window" } : null,
        note: timed.length ? "runs ended inside their time window" : "No scope set a time limit yet",
      }),
    ],
    boundary: {
      mode: "all",
      targets,
      summary: `${plural(targets.length, "target")} tested across ${plural(n, "run")}`,
    },
    approvals: {
      rows: rows.slice(0, MAX_APPROVALS),
      more: Math.max(0, rows.length - MAX_APPROVALS),
      meta: plural(rows.length, "request"),
      empty: "No gated actions in any saved plan.",
    },
    permitted: {
      actions: countChips(
        scoped.map((v) => v.scope!.actions),
        (a, runs) => `${a}: permitted in ${plural(runs, "run")}`,
      ),
      tools: countChips(
        scoped.map((v) => v.scope!.tools),
        (t, runs) => `${t}: approved in ${plural(runs, "run")}`,
      ),
    },
    limits: {
      rows: [
        { label: "Methods", chips: countChips(scoped.map((v) => v.scope!.methods), (m, runs) => `${m}: allowed in ${plural(runs, "run")}`) },
        {
          label: "Window",
          chips: countChips(
            timed.map((v) => [minutesLimit(v.scope!.windowMinutes)]),
            (w, runs) => `${w} time limit in ${plural(runs, "run")}`,
          ),
        },
      ],
      usage: null,
    },
  };
}
