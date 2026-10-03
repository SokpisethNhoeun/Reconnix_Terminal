# Reconix — TUI Demo

An interactive, keyboard-first terminal UI for **Reconix**, the AI-powered
security-testing assistant. Built with [Textual](https://textual.textualize.io/)
+ Rich. This is a **demo with mocked data** — no real scanning happens — that
mirrors the Figma design and doubles as the front-end skeleton for the real
backend.

Flow: **Assessment Start → Scope → Plan → Approval → Execution → Findings →
Finding Detail → Report**.

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
pip install -r requirements-dev.txt
pytest -q
```

> Requires Python 3.9+. For the intended look, use a terminal with a
> **JetBrains Mono** (or any Nerd/▮ box-drawing) font and a dark background.

## Keys

The interaction follows Claude Code: questions are ↑/↓ menus, `/` opens
command suggestions, and `?` shows the keys for the screen you are on.

| Key | Action |
|-----|--------|
| `/` | command suggestions: inline above the Start prompt, a command bar elsewhere |
| `↑` / `↓` | move through menus, suggestions, lists and tables; prompt history on Start |
| `Enter` | confirm the highlighted choice, send the request, or run the command |
| `Esc` | close a menu or dialog, clear the prompt, skip the "thinking" spinner, or go back |
| `Tab` | complete the highlighted command; on Plan, switch between menu and steps |
| `←` / `→` | previous / next screen in the flow |
| `1`…`9` | pick a numbered choice in the focused menu |
| `1`…`8` | jump to any screen when no menu has focus (handy when presenting) |
| `y` / `n` / `d` | approve / reject / view details at the approval gate |
| `PgUp` / `PgDn` | scroll a long dialog (e.g. approval details) |
| `Ctrl+R` | search prompt history (on the Start prompt) |
| `f` / `s` | filter / cycle the sort of the Findings list |
| `[` / `]` | previous / next finding on Finding Detail (same filter and sort) |
| `p` / `w` / `j` | export report (PDF / DOCX / JSON) — stubbed |
| `?` | shortcuts for the current screen (on Start: when the prompt is empty) |
| `Ctrl+Q` | quit |

The line under the top bar tracks the flow: `✓` done, `✕` stopped, `●` the current
step. Options that aren't available in the demo are shown dimmed with
"(not in demo)" and can't be picked.

## Commands

Type `/`, keep typing to filter, `↑`/`↓` to pick, `Tab` to complete, `Enter` to run.

| Command | Does |
|---------|------|
| `/help` | shortcuts for the current screen |
| `/new` | back to the start prompt (alias `/start`) |
| `/scope`, `/plan`, `/approval`, `/findings`, `/report` | open that screen |
| `/status` | live execution, only after approval (alias `/execution`) |
| `/finding [id]` | open a finding; without an id, pick one from a menu |
| `/export [pdf\|docx\|json]` | export the report; typing `/export ` lists the formats |
| `/audit` | the audit trail: every action, plus feedback you typed |
| `/quit` | quit (alias `/exit`) |

## Approval gate

Every human-in-the-loop question looks like Claude Code's: a chip, the question,
numbered choices with a description line, then **Type something.** (write your own
answer; it is saved as feedback for that step) and **Chat about this** (continue in
the prompt instead). The approval gate offers **Approve & run**, **Reject**,
**View details** and **Edit params**. For a HIGH-risk step, Approve opens a second confirmation with
**No, go back** selected; move to **Yes, run it** and press Enter to approve.
The store enforces this: `store.approve()` refuses a HIGH-risk approval without
the single-use token from `store.request_confirmation()`, and checks the command
hash. `→` and `/status` cannot reach Execution until the step is approved; the
`1`…`8` presenter jumps still can (demo only).

## Project layout

```
reconix-tui/
├── run.py                  # launcher
├── requirements.txt
├── requirements-dev.txt    # + pytest, pytest-asyncio
├── pyproject.toml
├── tests/                  # pytest + Textual Pilot
└── reconix/
    ├── app.py              # App, flow navigation, key bindings, command runner
    ├── commands/           # slash commands: registry + built-ins
    ├── models/             # dataclasses (Assessment, PlanStep, Finding, Choice, …)
    ├── store/              # in-memory list store — the only data the UI reads
    │   ├── lists.py        # the shared Python lists
    │   ├── seed.py         # demo rows loaded at startup
    │   └── <resource>.py   # read/add functions per resource (incl. prompt history)
    ├── theme.py            # color tokens for Rich markup
    ├── reconix.tcss        # Textual stylesheet (same palette)
    ├── widgets/
    │   ├── chrome.py       # session bar + flow progress line
    │   ├── choice_menu.py  # ↑/↓ menus
    │   ├── prompt.py       # prompt with slash suggestions + hint line
    │   ├── question.py     # Claude-style question (chip, numbered choices, hint)
    │   ├── history.py      # ↑/↓ prompt history
    │   └── chat.py         # `› request` line
    └── screens/
        ├── start.py        # 01 Assessment Start (prompt)
        ├── scope.py        # 02 Scope manifest (menu)
        ├── plan.py         # 03 Test plan (menu + browsable steps)
        ├── approval.py     # 04 Approval gate (menu + HIGH-risk confirmation)
        ├── execution.py    # 05 Live execution (animated)
        ├── findings_list.py# 06 Findings table (↑/↓ select)
        ├── finding_detail.py# 07 Finding detail
        ├── report.py       # 08 Report
        ├── choice.py       # ↑/↓ dialog: confirmations, details, command choices
        ├── command_bar.py  # `/` command bar
        └── help.py         # ? contextual shortcuts
```

## Wiring the real backend

Everything the UI shows comes from functions in `reconix/store/`
(`store.list_findings()`, `store.add_request()`, `store.approve()`, …), which
read and append to the shared lists in `store/lists.py`. No database, no API.
Actions such as submitting a request, approving or rejecting, finishing
execution, or requesting an export append rows (requests, approval decisions,
audit events).

To connect the real Reconix FastAPI backend, keep each store function's name
and return type and replace its body with an HTTPX call. The screens need no
other changes.
