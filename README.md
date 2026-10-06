# Reconix — TUI Demo

An interactive, keyboard-first terminal UI for **Reconix**, the AI-guided
security-testing assistant. Built with [Textual](https://textual.textualize.io/)
+ Rich. This is a **demo with mocked data** (no real scanning happens) that
follows the design walkthrough (`docs/design/`) and doubles as the front-end
skeleton for the real backend.

You type a real target; Reconix parses it (rule-based, no LLM) and the matching
template — **Network, API, Source Code or Web URL** — builds that assessment's scope,
run, findings and login from it. Scope is editable, several assessments can run in one
session (F6), and findings can be imported from real tool output (`/import`). No real
scanning happens. The run lives in memory; each started assessment is also saved (without
any secret) to `~/.reconix/assessments/` so the **web dashboard** can analyse it.

One **dashboard** stays on screen: the AI Assistant on the left (chat plus the live
tool/policy stream), the Assessment Status and a live **plan** of named tasks on the
right, the prompt and F-keys at the bottom. Every step that needs a human opens as a
**dialog** over it:

**Plan → Approve Scope → Test → Authenticate → Validate → Analyze → Report**

## Run it

```bash
git clone git@github.com:SokpisethNhoeun/Reconnix_Terminal.git
cd reconix-tui
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m reconix          # or: python run.py
```

Press **Enter** on the empty prompt to start the demo request, or type a target:

- an **IPv4 address or range** (`192.0.2.10`, `10.0.0.0/24`) → Network
- an **http(s) URL** (`https://shop.example.com`) → Web URL, or API when the path or a
  keyword says so (`https://api.example.com/v1`)
- a **git repo URL or local path** (`github.com/acme/app`, `/home/me/project`) → Source Code

A clear target picks its template itself; a bare hostname asks you to pick one. Either
way the Scope Manifest still waits for your approval. A line without a target ("hi",
"what can you do?", "scan my network") gets a short answer and starts nothing; a
malformed one (`10.0.0.300`, a range wider than `/16`) is refused so you can fix it. Or
type `/template` to pick the template first and then its target.
The run plays on its own and stops at each gate until you decide.

Tests (Textual Pilot, no terminal needed):

```bash
pip install -r requirements-dev.txt
pytest -q
```

> Requires Python 3.9+. For the intended look, use a terminal of about 160×45
> with **JetBrains Mono** (or any font with box-drawing glyphs) on a dark
> background. Below 120 columns the right column stacks under the chat.

## The run

| Step | What you see | Your decision |
|------|--------------|---------------|
| Plan | the target is parsed; a clear one picks its template | **Select a Template** only for an ambiguous target (a bare hostname) — Network, API, Source Code or Web URL (each has its own real run) |
| Approve Scope | the **Scope Manifest** marked DRAFT: target, actions, methods, excluded paths, time limit, tools | Approve Scope, or Edit Scope (your note is recorded) |
| Test | the plan's tasks tick from pending to loading to done while the tool/policy stream scrolls on the left; `GET /admin` is **blocked by policy** | — |
| Authenticate | **Secure Input · Test Account** (masked password, session vault) | Save to vault |
| Validate | **Approval Required** (MEDIUM), then **High-Risk Action** (HIGH) | Approve / Reject; HIGH needs the exact phrase and a reason |
| Analyze | OWASP/CWE mapping, duplicates merged, evidence masked | — |
| Report | **F5 Generate Report**, then the **Assessment Summary** | HTML, SARIF, CSV, JSON, Markdown (DOCX/PDF optional) |

Esc on any gate dialog means "decide later": nothing runs, and Enter on the empty
prompt reopens it. Reject stops the run; `/new` starts a fresh one.

Reports are written to `./reports/<assessment>.<ext>`. **HTML** is a styled,
self-contained pentest report (navy masthead, severity summary, findings table and
detailed finding cards) — open it in a browser and use its **Print / Save as PDF**
button to export a PDF; page one is a one-page executive summary. Also available with no
extra setup: **SARIF** (for CI / code scanning), **CSV** (findings spreadsheet), **JSON**
and **Markdown**. **DOCX** is offered when `python-docx` is installed. One-click **PDF**
prints the styled HTML report with a headless Chrome/Chromium found on the machine (or
WeasyPrint, if installed) — set `RECONIX_CHROME` to point at a browser; without either,
use HTML → Print. Findings carry a triage **status** (open / fixed / accepted / false-positive) set
in the Findings dialog, and a second run on the same target adds a **"Changes since last
assessment"** section (new / resolved / recurring).

## Keys

| Key | Action |
|-----|--------|
| `Enter` | send the request; on an empty prompt, start the demo or reopen a paused step |
| `F2`…`F7` | Findings · Scope manifest · Activity log · Generate report · Assessments · toggle the Assistant pane |
| `Tab` | move focus: prompt, chat; fields and buttons in a dialog |
| `←` / `→` | move between the buttons (or report formats) in a dialog |
| `↑` / `↓` | prompt history, menus, tables, dialog fields |
| `Esc` | close a dialog (a gate stays paused), close the menu, clear the prompt |
| `/` | command suggestions |
| `Ctrl+R` | search prompt history |
| `?` | shortcuts for what is focused |
| `Ctrl+Q` | quit |

Safe defaults: the Scope dialog opens on **Edit Scope** and approvals on
**Reject**, so a stray Enter never approves anything. Dialogs have no letter
shortcuts.

## Commands

Type `/`, keep typing to filter, `↑`/`↓` to pick, `Tab` to complete, `Enter` to run.

| Command | Does |
|---------|------|
| `/findings` | the findings table and details (F2) |
| `/finding [id]` | open one finding; without an id, pick one from a menu |
| `/template [id]` | pick a template (network, api, source, web_url), then type its target; checked for that template (alias `/templates`). F3 shows the scope manifest |
| `/activity` | activity log + audit trail (F4; aliases `/audit`, `/log`) |
| `/report` | generate the report (F5; alias `/export`) |
| `/summary` | the assessment summary, once the run has finished |
| `/assessments` | list and reopen assessments (F6; alias `/list`) |
| `/import` | import tool output (nuclei / nmap / ZAP) into findings |
| `/new` | start a new assessment (alias `/start`); the audit trail is kept |
| `/web` | open the web dashboard in your browser (alias `/dashboard`) |
| `/help` | the keys |
| `/quit` | quit (alias `/exit`) |

## Web dashboard (read-only analysis)

The run happens in the TUI. A local web dashboard (`web/`, Next.js) shows **what was done**
across every saved assessment: findings by severity and per day, weakness categories,
assessments and their full timeline, blocked requests and every approval decision. It
never changes anything. Light and dark soft-UI (neumorphism) themes.

```bash
cd web
npm ci                    # once (Node 20+)
npm run build             # once, and after pulling changes
npm start                 # prints http://127.0.0.1:3100/login#token=… and opens it
```

- The TUI saves each started assessment as it changes to `~/.reconix/assessments/`
  (`RECONIX_DATA_DIR` moves it, `RECONIX_SAVE=0` turns saving off). Passwords, cookies,
  one-time codes and confirmation tokens are never saved.
- The dashboard listens on `127.0.0.1` only. The sign-in link carries a token that is new
  every start; it signs you in as the read-only `viewer`.
- Try it without running the TUI: `RECONIX_DATA_DIR=sample-data npm start`
  (`python scripts/make_sample_data.py` regenerates that folder through the real store).
- Export from the web too: an assessment's **Export ▾** menu previews the PDF, HTML report,
  JSON, CSV or SARIF before you download it (PDF needs Chrome/Chromium on that machine).
- Develop: `npm run dev` (hot reload), `npm test` (unit), `npm run lint`,
  `npm run typecheck`, `npm run e2e` (Playwright; needs `npx playwright install chromium`
  once, or `CHROMIUM_PATH=/usr/bin/chromium`).

Screens: `docs/design/web/`. Plan and decisions: `docs/WEB_DASHBOARD_PLAN.md`,
`docs/WEB_EXPORT_PREVIEW_PLAN.md`.

## Safety model

The UI is never the security boundary; the store (later, the backend) is.

- **Scope**: nothing in Testing plays until `store.approve_scope()` is recorded.
  Every proposed request goes through `store.check_request()` (method allowed,
  path not excluded); blocked requests are logged and counted.
- **Approvals**: `store.approve()` binds the decision to the request's command
  hash. HIGH risk also needs a single-use token from `request_confirmation()`, the
  exact phrase and a reason. A decision is only accepted while the run is waiting
  on that request, and only once.
- **Target login**: a step may need a session cookie, email + password, or a live
  one-time code. `store.provide_auth()` validates and stores the durable parts
  write-only (`models.Secret`); the one-time code is never stored. No secret appears
  in the chat, activity log, audit trail, findings or reports. The in-memory vault is
  not "encrypted", and the dialog does not say so.
- **Saved copies**: `store.autosave()` writes a field-by-field snapshot
  (`store/snapshot.py`), never the vault or tokens, through `store/redact.py` (URL
  passwords, cookies, bearer tokens, API keys and private keys in any text are masked),
  atomically to a private folder (0700, files 0600; a folder owned by someone else is
  refused). Imported tool output is redacted the same way. While Reconix asks for a target
  login, the prompt refuses text, so a pasted credential is never recorded. Tests check
  that no secret reaches a saved file.
- **Demo data** uses `staging.example.com` (RFC 2606) and fake, masked evidence.

## Project layout

```
reconix-tui/
├── run.py, pyproject.toml, requirements*.txt
├── docs/
│   ├── DASHBOARD_PLAN.md     # the redesign plan and its decisions
│   ├── WEB_DASHBOARD_PLAN.md # the web dashboard plan
│   └── design/               # reference frames (web/ holds the dashboard's screens)
├── scripts/                  # make_sample_data.py, export_tokens.py
├── web/                      # read-only analysis dashboard (Next.js) — see web/README.md
├── tests/                    # pytest + Textual Pilot
└── reconix/
    ├── app.py                # ReconixApp: dashboard, global keys, command runner
    ├── theme.py              # color tokens (Rich markup + $variables for the stylesheets)
    ├── styles/               # base.tcss, dashboard.tcss, dialogs.tcss
    ├── commands/             # slash commands: registry + built-ins
    ├── flow/                 # RunController (plays the run) + phase labels
    ├── models/               # dataclasses (Assessment, RunStep, ApprovalRequest, Finding, …)
    ├── store/                # in-memory store — the only data the UI reads or writes
    │   ├── lists.py          # the shared Python lists (+ SESSION_ID)
    │   ├── snapshot.py       # an assessment as plain JSON for the web (no secrets)
    │   ├── persist.py        # autosave() → ~/.reconix/assessments/<session>_<id>.json
    │   ├── seed.py           # demo assessment, scope, approvals, findings
    │   ├── scenario.py       # the scripted run (what the AI and tools do)
    │   ├── run.py            # advance(), gates, counters, progress
    │   └── scope.py, approvals.py, vault.py, templates.py, findings.py, report.py, …
    ├── widgets/
    │   ├── top_bar.py, fkey_bar.py, panel.py, kv_grid.py, format_picker.py
    │   ├── chat/             # AssistantLog, ChatEntryView, ResultCard
    │   ├── status/           # StatusPanel, CounterTiles, PlanPanel, progress_bar
    │   ├── activity_log.py
    │   └── prompt.py, choice_menu.py, question.py, history.py
    └── screens/
        ├── dashboard.py      # the one main screen
        ├── dialogs/          # template, scope_manifest, secure_input, approval,
        │                     #   findings, report, summary, activity, text_prompt
        ├── choice.py         # ↑/↓ choice dialog (e.g. /finding without an id)
        ├── command_bar.py    # `/` command bar
        └── help.py           # ? shortcuts
```

## Wiring the real backend

Everything the UI shows comes from functions in `reconix/store/`
(`store.advance()`, `store.list_chat()`, `store.approve()`, …), which read and
append to the shared lists in `store/lists.py`. No database, no API.

To connect the real Reconix FastAPI backend, keep each store function's name and
return type and replace its body with an HTTPX call. `store.advance()` becomes the
server's event stream (`flow/controller.py` already plays it step by step), and
the gate functions (`approve_scope`, `provide_auth`, `approve`, …) become the
endpoints that record decisions. The screens need no other changes.
