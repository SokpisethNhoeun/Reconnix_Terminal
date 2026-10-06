# CLAUDE.md — Reconix TUI

Keyboard-first terminal UI for **Reconix**, an AI-guided security-testing
assistant. Built with **Textual 8.x + Rich**, Python ≥ 3.9. The app runs on an
**in-memory list store** (`reconix/store/`) and is the front-end skeleton for the
Reconix FastAPI backend.

Design: one **dashboard** (assistant chat + live stream | assessment status + a
live **plan** of named tasks, prompt, F-keys) with every human decision as a
**dialog** over it. The target design is the walkthrough video; reference frames
are in `docs/design/` and the decisions in `docs/DASHBOARD_PLAN.md` and
`docs/PLAN_LIST_PLAN.md`.

Run: **Plan → Approve Scope → Test → Authenticate → Validate → Analyze → Report**.

A second, separate app, `web/` (Next.js 16), is a **read-only analysis dashboard**: the
TUI saves each started assessment (no secrets) to `~/.reconix/assessments/` and the web
reads that folder. Plan: `docs/WEB_DASHBOARD_PLAN.md`; rules: `web/README.md`.

## Commands

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m reconix                 # run the app (or: python run.py / reconix)
textual run --dev reconix.app:ReconixApp   # live CSS reload + devtools (needs textual-dev)
pip install -r requirements-dev.txt   # pytest + pytest-asyncio
pytest -q                         # store tests + Textual Pilot tests in tests/
python -m compileall -q reconix   # quick syntax check
python scripts/make_sample_data.py   # regenerate web/sample-data through the real store
python scripts/export_tokens.py      # theme.WEB_TOKENS -> web/src/styles/tokens.css
cd web && npm ci && npm run build && npm start   # the web dashboard (see web/README.md)
```

Tests live in `tests/` (`asyncio_mode = "auto"`). `conftest.py` resets the store
around every test, sets `RunController.SPEED = 0` and `ReportDialog.STEP_SECONDS = 0`
(steps play instantly), and points `report.REPORTS_DIR` and `persist.DATA_DIR` at temp dirs.
`tests/support.py` has `SIZE`, `event_kinds()`, store drivers (`run_to(gate)`,
`decide(gate)`, `play_until_gate()`) and keyboard drivers (`start_run`, `pass_gate`,
`run_ui_to(app, pilot, gate)`). See the `write-tui-test` skill. There is no linter
in the venv yet; use `ruff` when adding one.

## Architecture

```
reconix/
├── app.py            # ReconixApp: pushes DashboardScreen; "/", "?", ^Q; run_command_line, submit_request
├── theme.py          # color tokens + chip helpers; CSS_TOKENS feeds the stylesheets' $variables
├── styles/           # base.tcss (shared widgets), dashboard.tcss, dialogs.tcss
├── commands/         # slash commands: registry.py (Command, match/find/parse) + builtin.py (COMMANDS)
├── flow/
│   ├── controller.py # RunController: plays store.advance() on timers, asks the host to open gates
│   └── phases.py     # phase id -> label, chip tone, busy spinner
├── models/           # dataclasses shared by store and screens (RunStep, RunState, Assessment,
│                     #   ApprovalRequest, AuthChallenge, ParsedTarget, …)
├── store/            # in-memory store — the only backend seam
│   ├── __init__.py   # the public functions screens call
│   ├── lists.py      # ASSESSMENTS (one per assessment) + CURRENT pointer; current()/set_current;
│   │                 #   session-wide trails (EVENTS, PROMPT_HISTORY, FEEDBACK)
│   ├── seed.py       # a fresh empty assessment; build_assessment/add_assessment; reset()
│   ├── parser.py     # parse_request(text) -> Optional[ParsedTarget]: the target's shape picks
│   │                 #   the template (rule-based; no LLM); None = no target (small talk)
│   ├── targets.py    # check_target(template_id, text): strict per-template validation
│   ├── replies.py    # short answers for lines that aren't a target
│   ├── templates/    # one module per kind (web_url/network/api/source) + base.py builder +
│   │                 #   __init__ (catalog, select_template builds scope/run/findings/auth)
│   ├── scenario.py   # the shared step builders (say/log/progress/gate) the templates use
│   ├── run.py        # start_run (parse+plan), advance, gate_state, display_phase, counters
│   ├── scope.py      # manifest, approve_scope, edit_scope, check_request (policy), time limit
│   ├── policy.py     # canonical_path() + host_port/repo checks per scope kind
│   ├── snapshot.py   # snapshot(assessment): plain JSON (schema reconix.assessment/v1), no secrets
│   ├── persist.py    # autosave(): write the current assessment if it changed (atomic, 0600)
│   ├── approvals.py  # MEDIUM/HIGH approval: hash (command_digest), token, reason
│   ├── vault.py      # target login: provide_auth (cookie/password/otp), Secret, authenticated
│   ├── importers/    # nuclei/nmap/zap parsers → Finding; detect() + import_file
│   └── findings.py (+ import_findings), report.py (+ report_markdown.py), transcript.py,
│                     #   assessment.py (list/switch), activity.py, history.py
├── widgets/          # reusable widgets — export in __init__.py
│   ├── panel.py      # Panel: titled box with a right-hand tag in the top border
│   ├── kv_grid.py    # KeyValueGrid / kv_table: aligned label/value rows
│   ├── top_bar.py, fkey_bar.py, format_picker.py, activity_log.py, secret_input.py
│   ├── chat/         # AssistantLog, ChatEntryView (text/banner/card/check), ResultCard
│   ├── status/       # StatusPanel, CounterTiles (Approvals/Findings), PlanPanel, progress_bar
│   └── prompt.py, choice_menu.py (ChoiceMenu, CompactMenu, SuggestionMenu), question.py, history.py
└── screens/
    ├── dashboard.py  # DashboardScreen: hosts the RunController, F-keys, prompt handling
    ├── dialogs/      # DialogScreen base + one file per dialog (template, target, scope_manifest,
    │                 #   scope_edit, secure_input, approval, findings, import_findings,
    │                 #   report, summary, activity, assessments)
    ├── choice.py     # ChoiceScreen: ↑/↓ choices (commands whose argument wasn't typed)
    ├── command_bar.py# `/` command bar (bottom modal)
    └── help.py       # contextual shortcuts overlay
```

Key invariants:

- **Typed input is validated by the store.** `store.submit_prompt(text)` starts a run on
  a target or answers small talk (`replies.py`) without starting one. A clear target (IPv4,
  URL, git repo, local path) picks its template itself (`apply_template(auto=True)`); a
  bare hostname waits at the template gate; `/template` → `TargetDialog` →
  `store.start_run(text, template_id)` validated by `store.check_target`. None of these
  skips the Scope Manifest gate.
- **Real-use data, still list-backed (no backend, no LLM).** The operator's typed
  target is parsed (`store.parser`) into a `ParsedTarget`; the chosen template
  (`store/templates/<kind>.py`) builds that assessment's scope, run script, approvals,
  findings and login kind from the target. `scenario.py` is only the shared step
  builders; `templates/base.py` weaves them into the standard phased run. To add a
  template, add a module with `SPEC`, `build_scope`, `build_run` and register it in
  `templates/__init__.MODULES`.
- **Each assessment is self-contained.** `models.Assessment` holds its own run, scope,
  findings, chat, activity, vault, approvals. `lists.ASSESSMENTS` holds them all and
  `lists.current()` is the one on screen; `store.switch_assessment(i)` reopens another
  and the app rebuilds the dashboard. Audit events, prompt history and feedback are
  session-wide. The store is the in-memory truth; `store.autosave()` (called from the
  dashboard's `refresh_view()` and on unmount) only writes a copy for the web dashboard.
- **Saved copies never hold secrets.** `snapshot.py` builds the JSON field by field (never
  `asdict` on an assessment): no vault entries or login identity, no confirmation tokens,
  and every string goes through `redact.redact_all()` (URL passwords, cookies, tokens, keys).
  Importers use the same `redact()`; `say_to_assistant` refuses text at the login gate.
  Add a field there and to `web/src/lib/data/schema.ts` together; `tests/test_persist.py`
  checks a known password, code and token never reach a file.
- **The run moves only through `store.advance()`.** At a gate it stays put until the
  store has recorded the decision (`select_template`, `approve_scope`, `provide_auth`,
  `approve` / `reject`). The controller never decides; it plays steps, redraws, and
  calls `host.open_gate(gate)`.
- **The dashboard is the run's host.** It implements `refresh_view()`,
  `open_gate()`, `run_finished()` and `run_failed()`. `open_gate` opens a dialog only
  while the run really waits there (`waiting_gate` set and the controller idle); a gate
  that arrives under another dialog is deferred and opened from `on_screen_resume`.
  After any store write, call `refresh_view()`; widgets read the store themselves
  (`AssistantLog.sync()`, `ActivityLog.sync()`, `StatusPanel.refresh_view()`).
- **Dialogs subclass `DialogScreen`** (`screens/dialogs/base.py`): set `HEADING`
  and `TONE`, implement `compose_content()`, `buttons()`, optionally `tag()`,
  `status()`, `first_focus()`, `on_close()`. A dialog calls the store itself and
  dismisses only on success; store errors go to `show_error()`. Gate dialogs
  dismiss with a result word ("approved", "rejected", "saved", "edit", …) or None.
- **Esc on a gate dialog means "decide later".** Nothing runs; Enter on the empty
  prompt (or F3 at the scope gate) reopens it. Reject is always an explicit button.
- **Safe first focus.** Scope opens on Edit Scope, approvals on Reject, HIGH on the
  reason field. No letter shortcuts in dialogs. Approve on HIGH stays disabled until
  a reason is typed.
- **Never open a dialog from inside a dialog.** Dismiss with a result and act in
  the dashboard's callback (see `_gate_closed`, `_report_closed`).
- **Screens never hold data literals.** Read through `reconix.store` functions,
  never `store.lists`. Writes go through store functions, which validate and raise
  `StoreValidationError` (show its message with `markup=False` or as `Text`).
- **Never put user or tool text into markup strings.** Build `rich.text.Text`
  (also for `DataTable` cells: a plain str cell is parsed as markup).
  `textual.markup.escape` misses `[UPPERCASE]` tags.
- **Subclasses never call `super().on_mount()`**: Textual already calls every
  `on_mount` up the class chain, so it would run twice.
- **No dead ends.** Unavailable options are shown dimmed "(not in demo)" and can't
  be picked (`Choice(disabled=True)`; templates and report formats use it). Never
  add a key or button that only pops an "isn't wired" toast.
- **Prompts are `PromptBox`.** It posts `Submitted` / `CommandSubmitted`; the
  dashboard calls `app.submit_request()` / `app.run_command_line()` and clears the box
  on success. `/` stays a non-priority app binding so Inputs still type it.
- **Colors come only from `theme.py`.** Use `theme.*` constants and helpers
  (`chip`, `severity_chip`, `risk_chip`) in Rich text and `$variables` in the
  stylesheets. `ReconixApp.get_css_variables()` merges `theme.CSS_TOKENS`, so a new
  token is added **once**, in `theme.py` (and to `CSS_TOKENS` if CSS needs it). Never
  write a hex value in a screen, widget or `.tcss` file.
- **Repeated UI becomes a widget** in `reconix/widgets/`, not copy-paste.

## Project rules (from AGENTS.md, applied to this TUI)

1. **No single-file code.** One screen or dialog per file, one concern per module.
   When wiring the backend, add `reconix/api/` (HTTPX client) and change the
   bodies of the `reconix/store/` functions to call it; keep their signatures.
2. **Clean folder structure.** Follow the layout above; keep `__init__.py` exports current.
3. **Validate on the backend.** The TUI is never the security boundary. Scope,
   allowed methods/paths, approval checks and the vault are enforced in the store
   (later: the backend). The UI may pre-check for UX (the phrase hint), but must
   show and respect the store's verdict.
4. **Protect actions by role.** Gated actions go through the approval dialogs and
   `store.approve()`. When auth is wired, hide or disable actions the current role
   cannot perform, and still treat the backend's 401/403 as final.
5. **Reusable components.** Prefer widgets, theme helpers and `DialogScreen` hooks over duplication.
6. **Plan before big features.** For anything touching several screens or the
   backend seam, write a short plan first (files to change, data contract, key
   bindings), then implement.

## Web dashboard (`web/`)

Read-only Next.js 16 app (App Router, TypeScript strict, Tailwind v4, neumorphism).
`web/src/lib/data/store.ts` is its only data source (reads + zod-validates the folder; never
writes). Pages are server components; filters and tabs are links/GET forms. Colors come
only from `tokens.css` (generated from `theme.WEB_TOKENS`). `src/proxy.ts` refuses foreign
Host headers, requires the `viewer` role (signed cookie from the launch token) and sets a
nonce CSP. Never render saved text as HTML. Tests: `npm test` (vitest) and `npm run e2e`.

## Security and safety context

This is an authorized security-testing tool. Demo data must only use reserved
example domains (`example.com`, RFC 2606) and fake, masked evidence. Never add
code that runs real scanners from the TUI; execution belongs to the backend,
behind scope checks and human approval.

Do not weaken the gates:
- `approve_scope()` is the only way into Testing. `check_request()` normalizes the
  target (`policy.canonical_path`: case, `..`, `;params`, percent-encoding, host and
  port) and blocks other hosts, methods outside the scope, excluded paths, and
  anything after the time limit; it records every verdict. Approval actions are
  policy-checked when their gate is reached (a block stops the run) and again in
  `approve()`.
- `approve()` requires the command hash, re-computed from the command (a request
  changed after it was shown is refused); HIGH also requires the newest unused token
  from `request_confirmation()` and a reason of 3+ visible characters (validated
  before the token is spent). Decisions are accepted only
  while the run waits on that request, and only once. Closing the HIGH dialog calls
  `decline_confirmation()`.
- Target login adapts to the step: a session cookie, email + password, or a live
  one-time code (`models.auth` challenges). `store.provide_auth` validates and stores
  the durable parts as `models.Secret` (masked `repr`/`str`/`asdict`/traceback) via the
  dialog's `SecretInput` (no copy/cut). **The one-time code is never stored.** No secret
  reaches chat, activity, audit events, findings or reports (tests check this). The
  in-memory vault is not "encrypted"; the UI must not say so.
- `edit_scope` applies the operator's scope changes before approval (validated per kind);
  the policy engine then enforces exactly what was approved.
- Imported findings (`import_findings`, `store/importers/`) only read a file, never run a
  tool; they get an `IMP-` id, show immediately, and their evidence is masked.
- Reports are written only to `REPORTS_DIR/<safe id>.<ext>`; Markdown output escapes
  every value from the run.

## Team: subagents and skills

Project subagents live in `.claude/agents/` and skills in `.claude/skills/`.
Delegate to them when the task matches. Run independent agents in parallel.

| Subagent | Use it for |
|----------|-----------|
| `tui-engineer` | Building or changing the dashboard, dialogs, widgets, bindings, TCSS layout |
| `backend-integrator` | Replacing the in-memory store bodies with FastAPI calls (HTTPX, models, errors) |
| `security-reviewer` | Reviewing scope enforcement, approval gates, role checks, secret handling, safe demo data |
| `qa-tester` | Writing and running Textual `Pilot` tests, reproducing UI bugs |
| `code-reviewer` | Final review of a change against the rules above before commit |

| Skill | Use it for |
|-------|-----------|
| `add-screen` | Checklist for adding a dialog (or, rarely, a full screen) |
| `add-widget` | Extracting or creating a reusable widget |
| `wire-backend` | Moving one data source from mock to a real backend endpoint |
| `theme-tokens` | Adding or changing colors in `theme.py` |
| `write-tui-test` | Writing store tests and Textual Pilot tests |

Typical feature workflow: plan, then `tui-engineer` and/or `backend-integrator`
implement, then `qa-tester` adds tests, then `security-reviewer` (if the change
touches scope, approval, auth, the vault or execution) and `code-reviewer` check it.

## Style

- Module docstring on every file.
- Type hints on public methods; `from __future__` is not used, so stay 3.9-compatible
  (`Optional[X]`, `List[X]`, not `X | None` or `list[X]`, in runtime-evaluated annotations).
- Section comments use the existing `# --- name ----` style; lines ≤ 100 characters.
- Rich text is built with `Text` / `Text.assemble` and `theme.*` colors.
