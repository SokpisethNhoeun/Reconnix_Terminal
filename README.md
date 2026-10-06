# Reconix — TUI Demo

An interactive, keyboard-first terminal UI for **Reconix**, the AI-powered
security-testing assistant. Built with [Textual](https://textual.textualize.io/)
+ Rich. Execution is **simulated** — no real scanning happens — but the process is
real: the target you type picks a template, the template builds the scope, plan,
approvals and findings, and a policy engine checks every request against the scope you
approved.

Flow: **Start → Template → Plan → Approval → Execution → Findings → Finding Detail →
Report**. A read-only **web dashboard** (`web/`) shows the saved assessments.

## Run it

```bash
git clone git@github.com:SokpisethNhoeun/Reconnix_Terminal.git
cd reconix-tui
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m reconix          # or: python run.py
```

Tests (Textual Pilot, no terminal needed):

```bash
pip install -r requirements-dev.txt     # + python-docx for the DOCX export
pytest -q
```

Web dashboard (Next.js, reads `~/.reconix/assessments`; `/web` in the TUI opens it):

```bash
cd web && npm install && npm run dev    # prints a sign-in link; /web opens the same one
RECONIX_DATA_DIR=sample-data npm run dev   # or browse the bundled sample assessments
```

> Requires Python 3.9+. For the intended look, use a terminal with a
> **JetBrains Mono** (or any Nerd/▮ box-drawing) font and a dark background.

## How an assessment runs

1. **Start** — type a target (a URL, an IPv4 address or range, a git repo or a local
   path) or press Enter on an empty prompt for the demo. Anything else gets a short
   answer and nothing starts.
2. **Template** — `/template` lets you pick one of four templates (Web URL, Network, API,
   Source Code) and type its target; a typed target picks its own template unless it fits
   several (then the screen asks, with the AI's pick recommended). Reconix drafts a
   **scope manifest**: approve it, edit it (methods, excluded paths, ports, tools, time
   limit), or reject it (nothing is tested; a fresh assessment starts).
3. **Plan** — every phase, the target login it may need, and each risky action with its
   exact request. **Run plan** starts testing.
4. **Execution** — the live run: tasks, an overall bar and the live output. It pauses
   when a step needs you: the **target login** opens a secure form (cookie, or email +
   password + one-time code; the code is never stored), and each **gated action** opens
   the Approval screen. `Ctrl+C` stops the run.
5. **Approval** — MEDIUM: approve or reject. HIGH: type a reason, approve, then confirm
   once more ("No, go back" is selected). Rejecting stops the assessment.
6. **Findings / Detail** — filter, sort, triage (open, fixed, accepted risk, false
   positive) and import nuclei / nmap / ZAP output.
7. **Report** — export HTML, PDF, DOCX, JSON, SARIF, CSV or Markdown to `./reports/`,
   or open the web dashboard.

The run keeps playing while you move between screens; when it reaches a gate the app
opens the screen that decides it. Every assessment of the session is kept:
`/assessments` reopens one where it stands.

## Keys

The interaction follows Claude Code: questions are ↑/↓ menus, `/` opens
command suggestions, and `?` shows the keys for the screen you are on.

| Key | Action |
|-----|--------|
| `/` | command suggestions: inline above the Start prompt, a command bar elsewhere |
| `↑` / `↓` | move through menus, suggestions, lists and tables; prompt history on Start |
| `Enter` | confirm the highlighted choice, send the request, or run the command; on Execution, open what the run waits for |
| `Esc` | close a menu or dialog, clear the prompt, or go back (on Approval: decide later) |
| `Tab` | complete the highlighted command; on Plan, switch between menu and steps |
| `←` / `→` | previous / next screen in the flow |
| `1`…`9` | pick a numbered choice in the focused menu |
| `1`…`8` | jump to any screen when no menu has focus (`2` = Template) |
| `d` | approval details (scope limits, exact request, audit trail) |
| `PgUp` / `PgDn` | scroll a long dialog |
| `Ctrl+R` | search prompt history (on the Start prompt) |
| `Ctrl+C` | stop the run (on Execution, after a confirmation) |
| `f` / `s` / `t` / `i` | Findings: filter / cycle the sort / triage / import tool output |
| `[` / `]` | previous / next finding on Finding Detail (same filter and sort) |
| `h` `p` `w` `j` `e` | Report: export HTML / PDF / DOCX / JSON / more formats |
| `b` | Report: open the web dashboard |
| `?` | shortcuts for the current screen (on Start: when the prompt is empty) |
| `Ctrl+Q` | quit |

The line under the top bar tracks the flow: `✓` done, `✕` stopped, `!` waiting for
you, `●` the current step. Options that aren't available are shown dimmed and can't be
picked.

## Commands

Type `/`, keep typing to filter, `↑`/`↓` to pick, `Tab` to complete, `Enter` to run.

| Command | Does |
|---------|------|
| `/help` | shortcuts for the current screen |
| `/new [target]` | start a new assessment, optionally on a target (alias `/start`) |
| `/template [id]` | the Template screen; with an id (`web_url`, `network`, `api`, `source`) straight to its target (alias `/templates`) |
| `/plan`, `/approval`, `/findings`, `/report` | open that screen |
| `/status` | live execution, once the plan runs (alias `/execution`) |
| `/finding [id]` | open a finding; without an id, pick one from a menu |
| `/export [format]` | export the report; without a format, pick one |
| `/summary` | the assessment summary (and open the saved report) |
| `/assessments` | list and reopen this session's assessments (alias `/list`) |
| `/import` | add findings from a nuclei / nmap / ZAP output file |
| `/audit` | activity log, audit trail and your feedback (aliases `/activity`, `/log`) |
| `/web` | open the web dashboard in your browser (alias `/dashboard`) |
| `/quit` | quit (alias `/exit`) |

`/scope` is now `/template`.

## Safety model

The store is the authority; the screens only ask. Testing starts only after the scope
is approved **and** the plan is run. Each risky action waits for a human decision bound
to the exact request (`store.approve()` checks the command hash); HIGH risk also needs a
typed reason and the single-use token from `store.request_confirmation()`. The policy
engine checks every request against the approved scope and blocks the rest. Target
logins live in memory for the session only; one-time codes are never stored; evidence
is masked; saved copies for the web dashboard (`~/.reconix/assessments`, 0600) never
contain a secret.

## Project layout

```
reconix-tui/
├── run.py                  # launcher
├── requirements*.txt, pyproject.toml
├── docs/                   # plans: CLASSIC_UI_PLAN (this branch), LLM integration, web …
├── scripts/                # export_tokens.py (web colors), make_sample_data.py
├── web/                    # read-only Next.js dashboard
├── tests/                  # pytest + Textual Pilot
└── reconix/
    ├── app.py              # ReconixApp: bindings and the command runner
    ├── shell/              # app behaviour: navigation, run_host (gates), actions, dialogs
    ├── flow/               # RunController (plays the run), gates → screens, phases
    ├── commands/           # slash commands: registry + built-ins
    ├── models/             # dataclasses (Assessment, RunStep, ScopeManifest, Finding, …)
    ├── store/              # in-memory store — the only data the UI reads
    │   ├── run.py          # the run: start, advance, gates, stop
    │   ├── templates/      # web_url, network, api, source: scope, plan, findings, steps
    │   ├── scope.py, policy.py, approvals.py, vault.py
    │   ├── findings.py, findings_view.py, importers/, retest.py
    │   ├── plan.py, progress.py      # the Plan screen's rows, the flow line's states
    │   └── report*.py, snapshot.py, persist.py   # exports; saved copies for the web
    ├── theme.py            # color tokens (the stylesheet's $variables come from here)
    ├── reconix.tcss        # Textual stylesheet
    ├── browser.py          # open a URL / saved report without disturbing the TUI
    ├── widgets/            # session bar + flow line, menus, prompt, question, run log,
    │                       #   scope manifest view, spinner, finding cells
    └── screens/
        ├── start.py        # 01 Start (prompt)
        ├── template.py     # 02 Template + scope manifest (replaces scope.py)
        ├── plan.py         # 03 Test plan
        ├── approval.py     # 04 Approval gate
        ├── execution.py    # 05 Live execution
        ├── findings_list.py, finding_detail.py, report.py   # 06–08
        ├── forms/          # FormScreen: target login, scope edit, import
        ├── choice.py       # ↑/↓ dialog: confirmations, details, pickers
        ├── command_bar.py  # `/` command bar
        └── help.py         # ? contextual shortcuts
```

## Wiring the real backend

Everything the UI shows comes from functions in `reconix/store/`. To connect the
Reconix backend, keep each store function's name and return type and replace its body
with an API call; `store.advance()` becomes the server's event stream and the
`RunController` stays the same. See `docs/LLM_INTEGRATION_PLAN.md`.
