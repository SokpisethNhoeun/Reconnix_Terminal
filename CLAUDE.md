# CLAUDE.md — Reconix TUI

Keyboard-first terminal UI for **Reconix**, an AI-powered security-testing
assistant. Built with **Textual 8.x + Rich**, Python ≥ 3.9. The app currently
runs on an **in-memory list store** (`reconix/store/`) and is the front-end skeleton for the
Reconix FastAPI backend.

Flow: **Start → Scope → Plan → Approval → Execution → Findings → Finding Detail → Report**.

## Commands

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m reconix                 # run the app (or: python run.py / reconix)
textual run --dev reconix.app:ReconixApp   # live CSS reload + devtools (needs textual-dev)
pip install -r requirements-dev.txt   # pytest + pytest-asyncio
pytest -q                         # Textual Pilot tests in tests/
python -m compileall -q reconix   # quick syntax check
```

Tests live in `tests/` (`asyncio_mode = "auto"`; an autouse fixture resets the
store around every test; `tests/support.py` has `SIZE`, `show()`, `event_kinds()`).
See the `write-tui-test` skill. There is no linter yet; use `ruff` when adding one.

## Architecture

```
reconix/
├── app.py            # ReconixApp: FLOW, bindings, go_next/goto, run_command_line, submit_request
├── commands/         # slash commands: registry.py (Command, match/find/parse) + builtin.py (COMMANDS)
├── models/          # dataclasses shared by store and screens
├── store/           # in-memory list store — the only backend seam
│   ├── __init__.py   # public functions screens call (list_*, get_*, add_*, approve, log_event)
│   ├── lists.py      # the shared Python lists (only store modules touch them)
│   ├── seed.py       # demo rows loaded at import; store.reset() reloads them
│   └── <resource>.py # assessment, plan (approval), execution, findings (filter/sort),
│                     #   activity, history, progress (step_states for the tracker)
├── theme.py          # color tokens + badge helpers for Rich markup
├── reconix.tcss      # Textual stylesheet (same palette as theme.py)
├── widgets/          # reusable widgets — export in __init__.py
│   ├── chrome.py     # SessionBar, FlowProgress (flow step tracker under the bar)
│   ├── choice_menu.py# ChoiceMenu (↑/↓ menu, posts Chosen), SuggestionMenu, menu_hint()
│   ├── prompt.py     # PromptBox / PromptInput: slash suggestions, history, hint line
│   ├── question.py   # Question: chip + bold question + numbered ChoiceMenu + hint (Claude-style HITL)
│   ├── history.py    # PromptHistory (↑/↓ navigator)
│   └── chat.py       # UserMessage (`› request`, rendered as Text)
└── screens/
    ├── base.py       # ReconixScreen: chrome + body + footer; subclasses implement compose_body()
    ├── <frame>.py    # one file per flow frame
    ├── choice.py     # ChoiceScreen dialog (+ details_body()) for confirmations, details, choices
    ├── command_bar.py# `/` command bar (bottom modal)
    └── help.py       # contextual shortcuts overlay
```

Key invariants:

- **Every flow screen subclasses `ReconixScreen`** and sets `flow_name`,
  `mode_name`, and optionally `scroll = False`. Screens only implement
  `compose_body()`; never re-implement the chrome.
- **Navigation goes through the app**: `self.app.go_next()`, `go_prev()`,
  `goto(name)`. Flow order lives only in `FLOW` in `app.py`. A new screen must be
  added to `FLOW`, to `screens/__init__.py`, to the `1…8` jump bindings if it is a
  flow frame, and to `help.py` and the README key table.
- **Screens never hold data literals.** Read through `reconix.store` functions,
  never `store.lists` directly. Writes go through store functions too
  (`add_request`, `approve`, `reject`, `log_event`), which validate input and
  raise `StoreValidationError`. Getters return list copies. Shared UI state
  such as `selected_finding` lives on `ReconixApp`.
- **The sent request is a `UserMessage`** (highlighted bar, like Claude Code).
- **Never put user or tool text into markup strings.** Build a `rich.text.Text`
  (see `UserMessage`, the execution log, `ChoiceMenu` prompts). `textual.markup.escape`
  misses `[UPPERCASE]` tags, so it is not enough.
- **The flow tracker reads the store.** `FlowProgress` (in `ReconixScreen`) shows
  `store.step_states()`; call `refresh_progress()` after a screen changes a step
  (Execution does after finish/stop). Order comes from `app.flow_order()`.
- **No dead ends.** An option that isn't available is `Choice(..., disabled=True)`:
  dimmed with "(not in demo)", skipped by ↑/↓, ignored by digits and Enter. Never
  add a choice, key or button that only pops an "isn't wired" toast.
- **Findings view state** (`findings_filter`, `findings_sort`) lives on the app;
  `store.find_findings(filter, sort)` returns `(store index, finding)` pairs and
  table row keys are store indexes (never use the cursor row as an index).
- **Thinking spinner.** `app.submit_request` calls `screen.think(...)` for a short
  spinner above the prompt (`THINKING_SECONDS`, 0 in tests); Esc skips, Enter never does.
- **Notify user text with `markup=False`** (e.g. unknown commands, store errors).
- **Real actions ask first, and the store records them.** Stopping the scan
  (`Ctrl+C` on Execution) and validating a finding (`v`) open a `ChoiceScreen`;
  validation calls `store.validate_finding`. Free text from "Type something." is
  saved with `store.add_feedback` and echoed on screen. `/audit` (`app.show_audit`)
  shows `store.list_events()` + `store.list_feedback()`. Never fake these with a bare notify.
- **Human-in-the-loop questions use the `Question` widget**, drawn like Claude Code:
  chip, bold question, numbered choices with a description line, `(Recommended)`, and
  the hint "Enter to select · ↑/↓ to navigate · Esc to …". It adds "Type something."
  (free text → `ChoiceMenu.Typed` → `store.add_feedback`) and "Chat about this"
  (`chat` → `app.open_chat`); `ReconixScreen` handles both. Handle `ChoiceMenu.Chosen`,
  never a raw `OptionList.OptionSelected`, and add `Binding("enter", "choose", show=False)`
  so Enter works when focus leaves the menu. A focused menu takes 1–9 for its numbered
  choices (the 1…8 jumps work elsewhere). Pop-up questions use `ChoiceScreen`; risky
  ones (`danger=True`) are unnumbered, have no shortcuts, and default to the safe choice.
- **Prompts are `PromptBox`.** It posts `Submitted` / `CommandSubmitted`; the screen
  calls `app.submit_request()` / `app.run_command_line()` and clears the box on
  success. The widget never writes to the store. Suggestions are a CSS overlay
  above the input, so opening them never moves the input.
- **Slash commands live in `reconix/commands/`** (`COMMANDS` is a tuple). Handlers only
  call app methods; the app runs them and records history. The `/` app binding
  must stay non-priority, or focused Inputs stop receiving `/`.
- **Never call `goto()` from inside a modal.** Dismiss with a result and act in the
  callback (`switch_screen` under a modal drops the modal's callback).
- **Colors come only from tokens.** Use `theme.*` constants and
  `theme.severity_badge / status_badge / risk_badge` in Rich markup, and `$vars`
  in `reconix.tcss`. Never hard-code a hex value in a screen. If you add a token,
  add it to **both** `theme.py` and `reconix.tcss`.
- **Repeated UI becomes a widget** in `reconix/widgets/`, not copy-paste.
- The Start prompt and the command bar have a focused `Input`, so `←`/`→` move
  the cursor there. Everywhere else they walk the flow.

## Project rules (from AGENTS.md, applied to this TUI)

1. **No single-file code.** One screen per file, one concern per module.
   When wiring the backend, add `reconix/api/` (HTTPX client) and change the
   bodies of the `reconix/store/` functions to call it; keep their signatures.
2. **Clean folder structure.** Follow the layout above; keep `__init__.py` exports current.
3. **Validate on the backend.** The TUI is never the security boundary. Scope,
   allowed actions/ports/tools, and approval checks must be enforced by
   the backend. The UI may pre-validate for UX, but must also show and respect
   the backend's verdict.
4. **Protect actions by role.** Steps with `gate == "approve"` or HIGH risk must
   go through the approval gate. When auth is wired, hide or disable actions the
   current role cannot perform, and still treat the backend's 401/403 as final.
5. **Reusable components.** Prefer widgets, theme helpers, and `ReconixScreen` hooks over duplication.
6. **Plan before big features.** For anything touching several screens or the
   backend seam, write a short plan first (files to change, data contract, key
   bindings), then implement.

## Security and safety context

This is an authorized security-testing tool. Demo data must only use reserved
example domains (`example.com`, RFC 2606) and fake evidence. Never add code that
runs real scanners from the TUI directly; execution belongs to the backend,
behind scope checks and human approval. Execution is the one hard gate: `app._show`
refuses to open it (even via a `1…8` jump) unless `app.can_enter_execution()`.
Do not weaken the approval gate:
HIGH-risk steps need a second, explicit confirmation that the store enforces
(`request_confirmation()` issues a single-use token; `approve()` requires it plus
the matching command hash). The confirmation dialog defaults to "No, go back".

**Demo-only shortcuts that must not reach real mode:**
- The `1…8` presenter jumps can reach Execution without approval. (`→`, `Enter`
  and `/status` are guarded by `app.can_enter_execution()`.)

When the backend is wired, put the jumps behind mock mode only, and make Execution
start only from a backend-confirmed approval.

## Team: subagents and skills

Project subagents live in `.claude/agents/` and skills in `.claude/skills/`.
Delegate to them when the task matches. Run independent agents in parallel.

| Subagent | Use it for |
|----------|-----------|
| `tui-engineer` | Building or changing screens, widgets, bindings, TCSS layout |
| `backend-integrator` | Replacing the in-memory store bodies with FastAPI calls (HTTPX, models, errors) |
| `security-reviewer` | Reviewing scope enforcement, approval gate, role checks, secret handling, safe demo data |
| `qa-tester` | Writing and running Textual `Pilot` tests, reproducing UI bugs |
| `code-reviewer` | Final review of a change against the rules above before commit |

| Skill | Use it for |
|-------|-----------|
| `add-screen` | Step-by-step checklist to add a new flow screen correctly |
| `add-widget` | Extracting or creating a reusable widget |
| `wire-backend` | Moving one data source from mock to a real backend endpoint |
| `theme-tokens` | Adding or changing colors while keeping `theme.py` and `reconix.tcss` in sync |
| `write-tui-test` | Writing Textual tests with `run_test()` and `Pilot` |

Typical feature workflow: plan, then `tui-engineer` and/or `backend-integrator`
implement, then `qa-tester` adds tests, then `security-reviewer` (if the change
touches scope, approval, auth, or execution) and `code-reviewer` check it.

## Style

- Module docstring on every file (screens start with `"""Frame NN — <name>."""`).
- Type hints on public methods; `from __future__` is not used, so stay 3.9-compatible
  (`Optional[X]`, not `X | None`, in runtime-evaluated annotations).
- Section comments use the existing `# --- name ----` style.
- Match existing Rich markup idioms: `f"[{theme.DIM}]text[/]"`, with `markup=True` on `Static`.
