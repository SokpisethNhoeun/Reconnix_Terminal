# CLAUDE.md — Reconix TUI (classic UI)

Keyboard-first terminal UI for **Reconix**, an AI-powered security-testing
assistant. Built with **Textual 8.x + Rich**, Python ≥ 3.9. The app runs on an
**in-memory store** (`reconix/store/`) that plays a realistic, simulated assessment
and is the seam for the Reconix backend. A read-only Next.js dashboard lives in `web/`.

Flow: **Start → Template → Plan → Approval → Execution → Findings → Finding Detail → Report**.
Branch `classic-ui`: the original full-screen UI (53ac746) running version 1's process —
see `docs/CLASSIC_UI_PLAN.md`.

## Commands

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m reconix                 # run the app (or: python run.py / reconix)
pip install -r requirements-dev.txt   # pytest + pytest-asyncio + python-docx
pytest -q                         # store tests + Textual Pilot tests (~70 s)
python -m compileall -q reconix   # quick syntax check
uvx ruff check --line-length 100 --select E,F,W,B reconix tests   # lint (no config yet)
cd web && npm run dev             # web dashboard (npm test / npx tsc --noEmit / npx eslint)
python scripts/make_sample_data.py    # regenerate web/sample-data after a process change
```

Tests: `tests/conftest.py` resets the store around every test, plays the run instantly
(`RunController.SPEED = 0`), points reports / saved copies / the web link at temp, and
stubs `browser.open_url/open_path` (the `opened` fixture records them — never launch a
real browser). `tests/support.py`: `run_to(gate)` / `decide(gate)` / `play_until_gate()`
drive the store; `run_ui_to(app, pilot, gate)` / `pass_gate()` drive the screens;
`settle(pilot)` lets screen switches and dialogs land (dialogs open on the app's next turn).

## Architecture

```
reconix/
├── app.py            # ReconixApp: bindings, run_command_line / run_command (mixes in shell/)
├── shell/            # app behaviour, one concern per module
│   ├── navigation.py # FLOW, goto / go_next / go_prev, reload_screen, open_dialog
│   ├── run_host.py   # hosts RunController; refresh_view, open_gate (deferral), resume_run
│   ├── actions.py    # submit_request, template/scope/plan decisions, new / switch assessment
│   └── dialogs.py    # assessments, triage, import, export, audit, summary, /web
├── flow/             # RunController (plays store steps), gates.py (gate → screen), phases
├── commands/         # registry.py (Command: choices, ask, empty) + builtin.py (COMMANDS)
├── models/           # dataclasses: Assessment, RunState/RunStep/PlanRow, ScopeManifest, …
├── store/            # the only backend seam; public functions in store/__init__.py
│   ├── run.py        # start, advance (gates), run_plan, reject_scope, stop_run, phases
│   ├── templates/    # per-template scope, plan, approvals, findings, script (base.py builds)
│   ├── scope.py / policy.py / approvals.py / vault.py    # enforcement lives here
│   ├── plan.py / progress.py / findings_view.py          # what the classic screens show
│   └── report*.py / snapshot.py / persist.py             # exports; saved copies for web/
├── theme.py          # color tokens; CSS_TOKENS feed the stylesheet's $variables
├── reconix.tcss      # Textual stylesheet (no hex values: $variables only)
├── browser.py        # open_url / open_path, detached and silent
├── widgets/          # SessionBar/FlowProgress, ChoiceMenu, PromptBox, Question, RunLog,
│                     #   ScopeManifestView, Spinner, finding cells (widgets/findings.py)
└── screens/
    ├── base.py       # ReconixScreen: chrome + body + footer; view_state / refresh_live
    ├── <frame>.py    # one file per flow frame (template.py replaced scope.py)
    ├── forms/        # FormScreen (+ LoginForm, ScopeEditForm, ImportForm)
    ├── choice.py     # ChoiceScreen dialog (+ details_body())
    ├── command_bar.py, help.py
```

Key invariants:

- **The store decides; screens ask.** Every decision goes through a store function that
  validates it and raises `StoreValidationError` (shown with `markup=False`). Screens never
  touch `store.lists` and never hold data literals. Getters return copies.
- **The run is hosted by the app** (`shell/run_host.py`), not a screen, so it plays while
  you browse. After each step the app calls `refresh_view()` on the top flow screen. A
  screen whose layout depends on the run returns that state from `view_state()`; a change
  rebuilds the screen (`app.reload_screen()`), or marks it stale if a dialog covers it.
  Small per-step updates go in `refresh_live()`.
- **Gates route to screens** (`flow/gates.py`): template + scope → Template, plan → Plan,
  approval:* → Approval, account → the LoginForm over the current screen. A gate that
  arrives while a dialog is open waits for it to close (`flow_screen_resumed`). After a
  decision, call `app.resume_run()` or `app.gate_decided(screen)`.
- **The app opens its dialogs with `app.open_dialog(dialog, callback)`**, never
  `push_screen` with a callback: Textual returns a result to whatever was handling a
  message at push time, and a flow screen may have been replaced since (the result is
  then lost). Screens may push their own dialogs while they stay on screen.
- **Navigation goes through the app**: `goto(name)`, `go_next()`, `go_prev()`. Flow order
  lives only in `FLOW` (`shell/navigation.py`). Execution opens only after the plan has run
  (`can_enter_execution`); ←/→ step over it until then. `_show` closes dialogs before it
  switches, so never call `goto()` from inside a modal anyway — dismiss and act in the callback.
  A new flow screen goes in `FLOW`, `screens/__init__.py`, the `1…8` bindings, `help.py`
  and the README.
- **Every flow screen subclasses `ReconixScreen`** and sets `flow_name`, `mode_name`,
  optionally `scroll = False`, and implements `compose_body()`.
- **Never put user, tool or scope text into markup.** Build `rich.text.Text` — including
  `border_title` / `border_subtitle` and `Label`s (Textual parses plain strings as markup).
- **Human-in-the-loop questions use the `Question` widget** (chip, numbered choices with a
  description, `(Recommended)`, "Type something." → `store.add_feedback`, "Chat about this"
  → `app.open_chat`). Handle `ChoiceMenu.Chosen`; add `Binding("enter", "choose", show=False)`.
  Pop-ups use `ChoiceScreen`; risky ones (`danger=True`) are unnumbered and default to the
  safe choice. The Approval menu highlights "View details" first so a stray Enter is harmless.
- **Text input pop-ups use `FormScreen`** (`screens/forms/`): fields, an error line, Submit /
  Cancel. `submit()` calls the store; a raised `StoreValidationError` keeps the form open.
  Secret fields use `SecretInput`; LoginForm wraps them in `Secret` and clears on close.
- **No dead ends.** Unavailable options are `Choice(..., disabled=True)` / disabled buttons.
- **Findings are keyed by `fid`** (`app.selected_finding`, table row keys);
  `store.find_findings(filter, sort)` returns findings; view state lives on the app.
- **Prompts are `PromptBox`**; slash commands live in `reconix/commands/` (handlers call app
  methods). A `Command` with `ask=False` uses its choices only as suggestions. The `/` app
  binding stays non-priority. A typed local path (`/home/me/app`) is a target, not a command.
- **Colors come only from tokens** (`theme.*` in Rich, `$vars` in TCSS, fed from
  `theme.CSS_TOKENS`). Add a token in `theme.py` only.
- **Repeated UI becomes a widget** in `reconix/widgets/`.

## Project rules (from AGENTS.md, applied to this TUI)

1. **No single-file code.** One screen per file, one concern per module (see `shell/`).
2. **Clean folder structure.** Follow the layout above; keep `__init__.py` exports current.
3. **Validate on the backend.** The store is the security boundary here; the UI may
   pre-check for UX (e.g. the HIGH reason length) but must show and respect the store's verdict.
4. **Protect actions by role.** Gated actions go through the approval gate; when auth is
   wired, hide or disable what the role can't do and treat 401/403 as final.
5. **Reusable components.** Widgets, `FormScreen`, `ChoiceScreen`, theme helpers.
6. **Plan before big features.** Write a short plan in `docs/` first.

## Security and safety context

Authorized security testing only. Demo data uses reserved example domains and fake,
masked evidence. Never run real scanners from the TUI; execution belongs to the backend,
behind scope checks and human approval. Do not weaken the gates: testing starts only after
the scope is approved and the plan is run; HIGH-risk actions need a typed reason, the
single-use token from `request_confirmation()` and the matching command hash
(`approve()` enforces all three); the confirmation dialog defaults to "No, go back". The
one-time code is validated and never stored; secrets never reach chat, logs, reports or
the saved copies (`snapshot.py` + `redact.py`).

## Team: subagents and skills

Project subagents live in `.claude/agents/` and skills in `.claude/skills/`.

| Subagent | Use it for |
|----------|-----------|
| `tui-engineer` | Building or changing screens, widgets, bindings, TCSS layout |
| `backend-integrator` | Replacing store bodies with backend calls |
| `security-reviewer` | Scope enforcement, approval gate, role checks, secret handling |
| `qa-tester` | Writing and running Textual `Pilot` tests |
| `code-reviewer` | Final review against the rules above |

| Skill | Use it for |
|-------|-----------|
| `add-screen` | Checklist to add a flow screen |
| `add-widget` | Extracting or creating a reusable widget |
| `wire-backend` | Moving one data source to a real backend endpoint |
| `theme-tokens` | Adding or changing colors |
| `write-tui-test` | Textual tests with `run_test()` and `Pilot` |

## Style

- Module docstring on every file (screens start with `"""Frame NN — <name>."""`).
- Type hints on public methods; stay 3.9-compatible (`Optional[X]`, not `X | None`).
- Section comments use the existing `# --- name ----` style; lines ≤ 100 characters.
