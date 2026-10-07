# Reconix — TUI Demo

An interactive, keyboard-first terminal UI for **Reconix**, the AI-powered
security-testing assistant. Built with [Textual](https://textual.textualize.io/)
+ Rich. Execution is **simulated** — no real scanning happens — but the process is
real: the target you type picks a template, the template builds the scope, plan,
approvals and findings, and a policy engine checks every request against the scope you
approved.

Flow: **Start → Template → Plan → Approval → Execution → Findings → Finding Detail →
Report**. A **web dashboard** (`web/`) shows the saved assessments, and its **Terminal**
page runs this same TUI in the browser.

## Run it

Needs **Python 3.9+** and, for the web dashboard, **Node.js 20+** (with npm) and Git.

**Linux / macOS**

```bash
git clone https://github.com/SokpisethNhoeun/Reconnix_Terminal.git
cd Reconnix_Terminal
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m reconix          # or: python run.py
```

**Windows 10 / 11** (PowerShell; use Windows Terminal for the TUI)

```powershell
git clone https://github.com/SokpisethNhoeun/Reconnix_Terminal.git
cd Reconnix_Terminal
py -m venv .venv               # or: python -m venv .venv
.venv\Scripts\Activate.ps1     # if scripts are blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
python -m reconix
```

Tests (Textual Pilot, no terminal needed):

```bash
pip install -r requirements-dev.txt     # + python-docx for the DOCX export
pytest -q
```

Web dashboard (Next.js, reads `~/.reconix/assessments`). Type `/web` in the TUI: the first
time it installs the dashboard's packages and starts it in the background (`npm run dev`,
output in `~/.reconix/web.log`), then your browser opens on it. A dashboard the TUI
started stops when you quit. To run it on its own (from the repository folder, with the
`.venv` above created: the Terminal page runs the TUI with it):

```bash
cd web && npm install && npm run dev    # prints a sign-in link; /web opens the same one
RECONIX_DATA_DIR=sample-data npm run dev   # or browse the bundled sample assessments
npm run dev -- --no-terminal            # without the Terminal page: the dashboard only reads
```

On Windows (PowerShell) the sample data is `$env:RECONIX_DATA_DIR = "sample-data"; npm run dev`.

**Terminal page.** The dashboard's sidebar has a **Terminal** link that runs the Reconix TUI
in the browser, with the same screens, commands and gates. Each browser tab gets its own
session (`python -m reconix` in a pseudo-terminal, started by `python -m reconix.webterm`
on `127.0.0.1:3101`). It keeps running while you look at the other pages and ends when you
close the tab; what it saves shows up on the other pages. It runs on Linux, macOS and
Windows 10+ (there in a ConPTY pseudo console, through `pywinpty`, which
`requirements.txt` installs on Windows only). See `docs/WEB_TERMINAL_PLAN.md` and
`docs/WEB_WINDOWS_PLAN.md`.

> Requires Python 3.9+. For the intended look, use a terminal with a
> **JetBrains Mono** (or any Nerd/▮ box-drawing) font and a dark background.

## How an assessment runs

1. **Start** — type a target (a URL, an IPv4 address or range, a git repo or a local
   path) or press Enter on an empty prompt for the demo. Anything else gets a short
   answer and nothing starts. After your first line the logo makes way for the
   conversation: your line on top, then Reconix's answer or one spinner line while it
   works (`Ctrl+O` lists the steps it finished).
2. **Template** — `/template` lets you pick one of four templates (Web URL, Network, API,
   Source Code) and type its target; a typed target picks its own template unless it fits
   several (then the screen asks, with the AI's pick recommended). Reconix drafts a
   **scope manifest**, shown in plain words (what it will test, what it may do, what it
   will never touch, its tools): approve it, edit it (methods, excluded paths, ports,
   tools, time limit), or reject it (nothing is tested; a fresh assessment starts).
3. **Plan** — every phase, the target login it may need, and each risky action with its
   exact request. **Run plan** starts testing.
4. **Execution** — the live run: each task queued, running, paused or done (no
   percentages: a backend can't know how far a scan has got), a spinner with what
   Reconix is on and for how long, and the live output (time · who · message). The
   output follows new lines while you're at the bottom; scroll up to read and it stays
   put until `End`. It pauses
   when a step needs you: the **target login** opens a secure form, and each **gated
   action** opens the Approval screen. `Ctrl+C` stops the run. The login comes from the
   scope's tools: OWASP ZAP needs a test account (email + password); Nuclei, Postman and
   ZAP API scan a session cookie; nmap, testssl.sh and the code scanners nothing. One
   login covers them all (a test account covers the cookie tools). If the target then
   asks for a one-time code, a second form asks for just the code. It is never stored.
5. **Approval** — MEDIUM: approve or reject. HIGH: approve, then double-check the exact
   request ("No, go back" is selected). Rejecting stops the assessment.
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
| `Ctrl+O` | expand / collapse the steps Reconix finished, under its spinner line |
| `End` | Execution: jump to the newest line of the live output and follow it again |
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
| `/web` | open the web dashboard (it starts it first if needed; alias `/dashboard`) |
| `/quit` | quit (alias `/exit`) |

`/scope` is now `/template`.

## Safety model

The store is the authority; the screens only ask. Testing starts only after the scope
is approved **and** the plan is run. Each risky action waits for a human decision bound
to the exact request (`store.approve()` checks the command hash); HIGH risk also needs a
double check, the single-use token from `store.request_confirmation()`. The policy
engine checks every request against the approved scope and blocks the rest. Target
logins live in memory for the session only; one-time codes are never stored; evidence
is masked; saved copies for the web dashboard (`~/.reconix/assessments`, 0600) never
contain a secret. The browser terminal only opens for the dashboard's own page with a
single-use ticket that only an operator gets, on 127.0.0.1; the helper proves itself before
the page sends a keystroke, never logs what is typed, and takes its TUIs down with it.

## Project layout

```
reconix-tui/
├── run.py                  # launcher
├── requirements*.txt, pyproject.toml
├── docs/                   # plans: CLASSIC_UI_PLAN (this branch), LLM integration, web …
├── scripts/                # export_tokens.py (web colors), make_sample_data.py
├── web/                    # Next.js dashboard (read-only pages + the Terminal page)
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
    │   ├── scope_view.py     # the scope manifest in plain words
    │   ├── findings.py, findings_view.py, importers/, retest.py
    │   ├── plan.py, progress.py      # the Plan screen's rows, the flow line's states
    │   └── report*.py, snapshot.py, persist.py   # exports; saved copies for the web
    ├── theme.py            # color tokens (the stylesheet's $variables come from here)
    ├── reconix.tcss        # Textual stylesheet
    ├── browser.py          # open a URL / saved report without disturbing the TUI
    ├── web_server.py       # /web starts and stops the dashboard (npm run dev in web/)
    ├── webterm/            # the Terminal page's server: tickets, origin check, sessions
    │                       #   (a pty on Linux/macOS, ConPTY on Windows)
    ├── widgets/            # session bar + flow line, menus, prompt, question, run log,
    │                       #   scope manifest view, spinner + activity line, finding cells
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
