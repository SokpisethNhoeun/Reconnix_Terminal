# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reconix TUI (classic UI)

Keyboard-first terminal UI for **Reconix**, an AI-powered security-testing
assistant. Built with **Textual 8.x + Rich**, Python ≥ 3.9. The app runs on an
**in-memory store** (`reconix/store/`) that plays a realistic, simulated assessment
and is the seam for the Reconix backend. A Next.js dashboard lives in `web/`: read-only
pages plus a **Terminal** page that runs this TUI in the browser (`reconix/webterm/`).

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
pytest -q tests/test_store_run.py             # one file
pytest -q tests/test_gates_ui.py::test_name   # one test   (or: pytest -q -k approval)
python -m compileall -q reconix   # quick syntax check
uvx ruff check --line-length 100 --select E,F,W,B reconix tests   # lint (no config yet;
                                  #   a few E501/E402 already exist, don't add more)
python scripts/make_sample_data.py    # regenerate web/sample-data after a process change
python scripts/export_tokens.py       # theme.WEB_TOKENS → web/src/styles/tokens.css

cd web && npm run dev             # web dashboard + terminal helper; RECONIX_DATA_DIR=sample-data
                                  #   for demo data, `-- --no-terminal` for read-only
npm test                          # vitest
npm run lint && npm run typecheck # typecheck needs `npx next typegen` (or a build) first
npm run build && npm run e2e      # Playwright on sample-data (needs a Chromium)
```

Tests: `asyncio_mode = "auto"`, so `async def test_…(app)` needs no marker; Pilot tests use
`app.run_test(size=SIZE)` (`SIZE` from `tests/support.py`). `tests/conftest.py` resets the store around every test, plays the run instantly
(`RunController.SPEED = 0`), points reports / saved copies / the web link at temp, and
stubs `browser.open_url/open_path` (the `opened` fixture records them — never launch a
real browser). `tests/support.py`: `run_to(gate)` / `decide(gate)` / `play_until_gate()`
drive the store; `run_ui_to(app, pilot, gate)` / `pass_gate()` drive the screens;
`settle(pilot)` lets screen switches and dialogs land (dialogs open on the app's next turn).
`store.DEMO_REQUEST` (a URL) skips the template gate; pass `ASK_REQUEST` to stop at it.
`TEST_PASSWORD` must never show up in output, logs, reports or saved copies. The
`web_launches` fixture stubs `web_server` (start/install/stop): no test starts a real dashboard.
`tests/test_webterm_server.py` runs the terminal server on a free port with a stand-in
program instead of the TUI.

## Architecture

```
reconix/
├── app.py            # ReconixApp: bindings, run_command_line / run_command (mixes in shell/)
├── shell/            # app behaviour, one concern per module
│   ├── navigation.py # FLOW, goto / go_next / go_prev, reload_screen, open_dialog
│   ├── run_host.py   # hosts RunController; refresh_view, open_gate (deferral), resume_run
│   ├── actions.py    # submit_request, template/scope/plan decisions, new / switch assessment
│   ├── dialogs.py    # assessments, triage, import, export, audit, summary
│   ├── llm.py        # /provider and /model: menus, ProviderForm, tests in a worker
│   ├── agent.py      # agent mode: /assess drives the backend harness, streams events
│   └── web.py        # /web: open the dashboard, starting it in the background if needed
├── flow/             # RunController (plays store steps), gates.py (gate → screen), phases
├── llm/              # flexible LLM (no UI, no store.lists): config, crypto (Fernet),
│                     #   db (sqlite3), catalog (6 providers), client (LiteLLM), guardrail
├── commands/         # registry.py (Command: choices, ask, empty) + builtin.py (COMMANDS)
├── models/           # dataclasses: Assessment, RunState/RunStep/PlanRow, ScopeManifest, …
├── store/            # the only backend seam; public functions in store/__init__.py
│   ├── run.py        # start, advance (gates), run_plan, reject_scope, stop_run, phases
│   ├── templates/    # per-template scope, plan, approvals, findings, script (base.py builds)
│   ├── scope.py / policy.py / approvals.py / vault.py    # enforcement lives here
│   ├── providers.py / llm_chat.py    # the LLM seam: configure/test/pick a model (providers.py);
│   │                                 #   turn a chat line into a model reply (llm_chat.py)
│   ├── agent_run.py  # the harness seam: drive backend/ Agent.chat; switch_model keeps history
│   ├── plan.py / progress.py / findings_view.py          # what the classic screens show
│   └── report*.py / snapshot.py / persist.py             # exports; saved copies for web/
├── theme.py          # color tokens; CSS_TOKENS feed the stylesheet's $variables
├── reconix.tcss      # Textual stylesheet (no hex values: $variables only)
├── browser.py        # open_url / open_path, detached and silent
├── web_server.py     # start / stop `npm run dev` in web/ quietly (log: ~/.reconix/web.log)
├── webterm/          # the web Terminal page's server (python -m reconix.webterm):
│                     #   settings, ticket (single use), guard (Host/Origin/ticket),
│                     #   protocol (frames, close codes), session (+ pty_posix: pty,
│                     #   pty_windows: ConPTY via pywinpty), server (websockets)
├── widgets/          # SessionBar/FlowProgress, ChoiceMenu, PromptBox, Question, RunLog,
│                     #   ScopeManifestView, Spinner/ActivityStatus,
│                     #   finding cells (widgets/findings.py)
└── screens/
    ├── base.py       # ReconixScreen: chrome + body + footer; view_state / refresh_live
    ├── <frame>.py    # one file per flow frame (template.py replaced scope.py)
    ├── forms/        # FormScreen (+ LoginForm, ScopeEditForm, ImportForm)
    ├── choice.py     # ChoiceScreen dialog (+ details_body())
    ├── command_bar.py, help.py
```

How the pieces connect:

- **Store state** is module-level lists in `store/lists.py` (`ASSESSMENTS`, `CURRENT`,
  session-wide `EVENTS`/history/feedback); only store modules import it. Importing
  `reconix.store` loads the demo data; `store.reset` reloads it.
- **A run is a list of `RunStep`s.** Choosing a template calls its module's
  `build_scope(parsed)` and `build_run(assessment) -> RunBundle`; `templates/base.py`
  (`RunProfile` → `build_script()`) weaves each template's content into the same phased
  script and gates, so all four templates behave alike. A new template registers in
  `templates/__init__.py` (`MODULES`, `CATALOG_ORDER`).
- **`RunController`** (`flow/controller.py`) holds no data: it `peek()`s the next step,
  waits `step.pause × SPEED`, calls `store.advance()`, then asks its host to redraw or
  open a gate. With the backend wired, `advance()` becomes the server's event stream.
- **The LLM seam** (`store/providers.py`, `store/llm_chat.py` over `reconix/llm/`): a chat
  line typed *during a run* goes to the active model (LiteLLM), with a fixed `SYSTEM_PROMPT`,
  the assessment state as context and the full history — all redacted. The model proposes
  narrative only; it has no tools and no path to a decision function. Providers, the active
  model and chat history live in one Fernet-encrypted SQLite file (`~/.reconix/llm.db`); the
  key lives in `~/.reconix/llm.key` (0600) and never enters env/logs/snapshots. With no
  active model, or on any `LLMError`, `run.llm_answer` falls back to the built-in reply, so
  the offline demo and existing tests keep working.
- **The harness seam** (`store/agent_run.py` over `backend/harness/`): when a `/model` is
  active, `/assess <target>` hands the whole assessment to the harness `Agent` (plan → real
  Kali-MCP scans → analyze), run in a worker; its streamed events render into the chat and
  activity log. The agent's LLM is Reconix's active provider (LiteLLM), set before each turn;
  `switch_model()` swaps only the client and keeps `Agent.history`, so a mid-assessment model
  switch preserves context. `/provider` + `/model` are the whole app's LLM control plane (the
  unified `LLM_*` env seeds the default `reconix` provider). Without a model/harness, the
  scripted demo runs — so the existing tests and offline demo are unaffected.
- **Saved copies for `web/`**: `persist.autosave` writes `snapshot()` (secrets removed) to
  `~/.reconix/assessments/` (`RECONIX_DATA_DIR`). The dashboard validates those files with
  `web/src/lib/data/schema.ts`: change it together with `store/snapshot.py`, then rerun
  `make_sample_data.py`.

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
  approval:* → Approval, account and code → the LoginForm over the current screen. A gate that
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
  `theme.CSS_TOKENS`). Add a token in `theme.py` only. Web colors come from
  `theme.WEB_TOKENS` through `scripts/export_tokens.py`; never edit the generated `tokens.css`.
- **Repeated UI becomes a widget** in `reconix/widgets/`.
- **Packages are listed explicitly** in `pyproject.toml` (`[tool.setuptools] packages`):
  a new subpackage must be added there or the installed `reconix` command won't find it.

## Web dashboard (`web/`)

Next.js 16 / React 19, **read-only except the Terminal page**: no route writes or deletes
anything, and the only thing started is the Terminal page's TUI (the ticket route hands out
a ticket; `reconix/webterm`, started by `web/scripts/serve.mjs`, runs the TUI), so its gates
are the store's gates. Minting a ticket needs the operator session cookie **and** the
terminal key cookie (`Path=/api/terminal`, signed differently); the helper proves itself
with a hello before the page sends anything; the TUI's pty is its controlling terminal, so
it dies with the helper (on Windows the TUI runs in a ConPTY console the helper owns, see
`docs/WEB_WINDOWS_PLAN.md`; keep both backends behind `webterm/session.py`'s `spawn()`). A stand-in command needs `RECONIX_TERM_TEST=1` (tests only).
Read `web/CLAUDE.md` and `web/README.md` (Rules) before changing it. This Next.js version
differs from older ones, so check `web/node_modules/next/dist/docs/` before writing code.
Every page and route needs the `viewer` role; `/terminal` and `/api/terminal/*` need
`operator` (`proxy.ts`, and the pages / handlers check again). The ticket format lives in
both `web/src/lib/auth/ticket.ts` and `reconix/webterm/ticket.py` (shared test vector), and
the frame protocol in `web/src/lib/terminal/protocol.ts` and `reconix/webterm/protocol.py`:
change each pair together. The helper never logs terminal data (`TEST_PASSWORD` test), and
the sign-in link (operator control) is printed only to a TTY, never to `~/.reconix/web.log`.

## Project rules (applied to this TUI)

1. **No single-file code.** One screen per file, one concern per module (see `shell/`).
2. **Clean folder structure.** Follow the layout above; keep `__init__.py` exports current.
3. **Validate on the backend.** The store is the security boundary here; the UI may
   pre-check for UX (e.g. the code's 6 digits) but must show and respect the store's verdict.
4. **Protect actions by role.** Gated actions go through the approval gate; when auth is
   wired, hide or disable what the role can't do and treat 401/403 as final.
5. **Reusable components.** Widgets, `FormScreen`, `ChoiceScreen`, theme helpers.
6. **Plan before big features.** Write a short plan in `docs/` first.

## Security and safety context

Authorized security testing only. Demo data uses reserved example domains and fake,
masked evidence. Never run real scanners from the TUI; execution belongs to the backend,
behind scope checks and human approval. Do not weaken the gates: testing starts only after
the scope is approved and the plan is run; HIGH-risk actions need a double check, the
single-use token from `request_confirmation()` and the matching command hash
(`approve()` enforces both; no typed reason, by the owner's decision); the confirmation
dialog defaults to "No, go back". The target login comes from the approved tools
(`store/tools.py`); a one-time code is its own step (`GATE_CODE`) right after the
password, validated and never stored; secrets never reach chat, logs, reports or the
saved copies (`snapshot.py` + `redact.py`).

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
