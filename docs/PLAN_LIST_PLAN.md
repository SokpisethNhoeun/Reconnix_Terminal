# Plan List redesign — right column becomes a live task plan

2026-10-05. Follows `DASHBOARD_PLAN.md` and `REAL_USE_PLAN.md`. No backend, no LLM,
memory-only — unchanged. This only reshapes the dashboard's right column and the left
stream; the store's run/progress/counters stay exactly as they are (the plan *reads* them).

## What the user asked for (clarified)

On the right column, **remove**: the phase bars (Discovery/Scanning/Validation/Analysis/
Report), the Activity Log panel, the AI Assistant→Policy→Tool pipeline strip, and the
Requests/Blocked counter tiles.

**Add**: a **plan list** — named tasks per template, each showing pending · / loading ⠹ /
done ✓. The detailed process **streams on the left** (the AI Assistant panel now shows the
chat *and* the tool/policy activity lines, interleaved in order).

**Keep** on the right: the facts grid (State, Assessment, Target, Template, Scope, Time)
and the **Approvals** + **Findings** tiles.

Plan **timing**: drafted when the template is chosen (visible while Planning), tasks flip
loading→done as the run proceeds.

**F7 toggles the whole left (Assistant) pane** open/closed; when closed, the status +
plan column fills the width. (The user first asked for a plan toggle, then redirected it
to the whole left pane — see the conversation.)

## Design

### Plan tasks (named per template, status derived from the run)
- `models.PlanTask(key, label, status)` — `key` ∈ the progress bars
  (discovery/scanning/validation/analysis/report), `label` is template-specific,
  `status` ∈ pending|active|done.
- Each template declares its 5 task labels (`RunProfile.plan`); `select_template` stores
  them on `Assessment.plan`.
- `store.plan_tasks()` derives status live from `run.progress` (and `run.completed` /
  `run.report_path` for the report task). No new run steps, no change to how steps play.

### Left = chat + live stream
- Every `ChatEntry`/`ActivityEntry` gets a monotonic `seq` (from `lists.next_seq()`), so
  the left panel can merge both logs in exact order.
- `AssistantLog` renders chat entries as bubbles and activity entries as compact
  `stream_line`s (glyph + message, colored by source). Incremental `sync()` by seq.
- `list_activity()` is unchanged, so the F4 Activity dialog and the audit trail keep
  working.

### Right column
- `StatusPanel`: facts grid + `CounterTiles` (Approvals, Findings only). Phase bars and
  pipeline strip removed.
- New `PlanPanel` (`Panel`, title "PLAN", tag `done/total`) holds `PlanList`; the active
  task spins on the 1 s tick.
- **F7** toggles a `-left-collapsed` class on the dashboard that hides `#assistant` and
  lets `#side` fill the width.

### Removed / kept
- Delete `widgets/status/phase_bars.py`, `widgets/status/pipeline_strip.py`, and the
  `ActivityLog` class (the dashboard panel). Keep `activity_line/activity_row/ActivityRows`
  (used by the F4 dialog).
- Keep the store fns `phase_progress()`, `counters()`, `pipeline_stage()` — they are the
  backend seam and the tests cover them; the plan derives from `phase_progress`.

## Tests
- `plan_tasks()` pending→active→done across a full run, per template.
- Left stream: `AssistantLog` mounts both chat and activity entries in order.
- Dashboard mounts `StatusPanel` + `PlanPanel` (no `ActivityLog`); F7 collapses the whole
  left pane.
