# Plan — single-dashboard redesign

Target design: `../../reconix-preview.mp4` (90 s walkthrough). Reference frames are
kept in `docs/design/` so the design stays visible without the video.

Decisions already made:

- The video is the **target design**.
- The app becomes **one dashboard screen** and every step opens as a **dialog** over it.
  The 8-screen flow (Start → Scope → Plan → Approval → Execution → Findings → Detail →
  Report) is removed.
- The bottom caption strip in the video ("PLAN — Describe the task…") is narration only
  and is **not** built.

## 1. The dashboard

```
┌ ◆ RECONIX v0.4.0 · AI-guided security testing assistant   assessment RCX-DEMO-001  status testing  policy ● enforced ┐
│┌ AI ASSISTANT ─────────────────────────────┐┌ ASSESSMENT STATUS ─────────────────────────┐│
││ reconix › Welcome to Reconix. …           ││ State       [⠿ Testing]                    ││
││     you › Assess https://staging…         ││ Assessment  RCX-DEMO-001                   ││
││ reconix › ┌ ▸ Discovery · OWASP ZAP ┐     ││ Target / Template / Scope / Time 03:43/30:00│
││           │ Public pages        18  │     ││ Discovery ████████████ 100%                ││
││           └─────────────────────────┘     ││ Scanning  ██████░░░░░░  53%  … Report      ││
││  policy › ✕ Blocked: GET /admin · …       ││ [Requests 690][Blocked 1][Approvals 0][Findings 0]│
││                                           ││ [AI Assistant]→[Policy Engine]→[Tool Service]││
││                                           │└────────────────────────────────────────────┘│
││                                           │┌ ACTIVITY LOG ───────────────────── live ┐   │
││                                           ││ 14:12:41 POLICY Blocked: Path outside … │   │
│└───────────────────────────────────────────┘└─────────────────────────────────────────┘   │
│ ❯ Describe your security task or select a template.                                       │
│ F2 Findings  F3 Scope  F4 Activity  F5 Generate Report        ↑↓ navigate Tab switch Enter select Esc back │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Widget | Shows |
| --- | --- | --- |
| Top bar | `TopBar` | brand, version, tagline · assessment id, status, `policy ● enforced` |
| Left | `AssistantLog` | chat lines (`reconix ›`, `you ›`, `policy ›`), result cards, coloured banners (blocked / warning / approved), checklists |
| Right top | `StatusPanel` | state badge, assessment, target, template, scope, elapsed / limit, 5 phase bars, 4 counter tiles, pipeline strip with the active stage lit |
| Right bottom | `ActivityLog` | live, timestamped rows tagged SYS / AI / USER / TOOL / POLICY; blocked rows on a red background |
| Bottom | `PromptBox` (kept) + `FKeyBar` | prompt; F2–F5 keys (F5 dimmed until the assessment is complete); key hints |

Below 140 columns the right column stacks under the assistant so nothing is cut off.

## 2. The dialogs (in run order)

| # | Dialog | Opens when | Contents | Store call |
| --- | --- | --- | --- | --- |
| 1 | Select a Template | the AI has parsed the target | Network · API · Source Code · Web URL, "AI SUGGESTED" tag | `select_template()` |
| 2 | Scope Manifest · Review | template chosen | DRAFT badge, target, assessment, allowed actions, methods, excluded paths, time limit, tools; Edit Scope / Approve Scope; "● Testing paused until approval" | `approve_scope()` / `add_feedback("scope", …)` |
| 3 | Secure Input · Test Account | a path needs login | ENCRYPTED badge, username, masked password, Save to vault, "Scope: … only" | `save_test_account()` |
| 4 | Approval Required (MEDIUM) | a MEDIUM action is proposed | RISK: MEDIUM, "proposed by AI · held by policy", action, target, purpose, impact; Approve / Reject | `approve()` / `reject()` |
| 5 | High-Risk Action | a HIGH action is proposed | as 4 + confirmation phrase (live "✓ Phrase matches") + required reason; Approve stays disabled until both are valid | `request_confirmation()` + `approve(…, phrase, reason)` |
| 6 | Findings (F2) | any time after the first finding | table ID / severity / finding / path / validation (REVIEW tag) + detail of the selected row: description, affected URL, masked evidence, impact, references, remediation | `find_findings()` |
| 7 | Generate Report (F5) | assessment complete | PDF / DOCX / JSON cards, progress bar, section checklist | `generate_report()` |
| 8 | Assessment Summary | report saved | COMPLETED badge, summary grid, "Plan → Approve Scope → Test → Validate → Analyze → Report" | read only |
| – | Scope (F3) | any time | dialog 2 in read-only mode with an APPROVED badge | read only |
| – | Activity (F4) | any time | full activity log + audit trail (replaces `/audit`) | `list_events()` |

All dialogs share one `DialogScreen` base: titled frame, optional badge at the top right,
a button row, Esc = the safe choice (Reject / close), and the safe button focused first.

## 3. How a run moves

The assessment runs **on its own between gates**, like the video. It only stops where a
human has to decide: the template, the scope, the test account and each approval.

```
request typed ─► AI parses target ─► [Template] ─► AI drafts scope ─► [Scope approve]
   ─► Testing (bars fill, requests count, GET /admin blocked by policy)
   ─► needs login ─► [Secure input] ─► candidate finding ─► [MEDIUM approval]
   ─► baseline request ─► [HIGH approval: phrase + reason] ─► limited validation
   ─► Analyzing (OWASP/CWE mapping, duplicates merged, evidence masked) ─► Completed
   ─► F5 [Report] ─► [Summary]
```

- `flow/controller.py` (`RunController`) plays the run. It asks the store for the next
  step (`store.advance()`), redraws, and opens the dialog when a step is a gate. Nothing
  advances past a gate until the store records the decision.
- The steps come from the store (`store/scenario.py`), not from the screen. With the
  real backend `advance()` becomes the server's event stream, and the controller stays the same.
- Timestamps are the real clock, not the video's canned times. Delays are a class constant
  set to 0 in tests (like `THINKING_SECONDS` today).
- Reject at any gate stops the run, logs it, and says so in the chat. There are no dead ends.

## 4. Security rules kept (and tightened)

- **Scope**: nothing in Testing runs until `approve_scope()` is recorded. The out-of-scope
  `GET /admin` is blocked **by the store's policy check**, not by the UI, and shows up as a
  POLICY row plus the Blocked counter.
- **Approvals**: keep the command-hash binding and the single-use token. HIGH also needs
  the exact phrase and a non-empty reason, and the **store** checks both. The UI check is
  only for the live "✓ Phrase matches" hint.
- **Test account**: `store/vault.py` keeps it in memory only. No getter returns the
  password. The chat, activity log, audit events and findings never contain it; a test
  asserts this. Validation (non-empty, length limits) is in the store.
- **Evidence** in findings is masked in the seed data (`usr_••••42`, `b•••@example.com`,
  `•••••••••• (masked)`).
- The `1…8` presenter jumps are removed. They were the one demo shortcut that could skip
  the approval gate.
- Demo data stays on `staging.example.com` (RFC 2606) with fake evidence.

## 5. File structure

```
reconix/
├── app.py                    # ReconixApp: pushes DashboardScreen; F2–F5, /, ?, Ctrl+Q
├── flow/                     # NEW
│   ├── phases.py             #   Phase enum + label + badge tone
│   └── controller.py         #   RunController
├── models/                   # + chat.py (ChatEntry), template.py, vault.py (TestAccount)
│                             #   updated: assessment.py, plan.py (risk/purpose/impact/reason), finding.py (path, validation, url)
├── store/                    # + templates.py, vault.py, run.py (run events, counters, phase progress)
│                             #   updated: plan.py (phrase + reason), progress.py, seed.py (the video's scenario)
├── widgets/
│   ├── panel.py              # Panel: titled border box + optional right-hand tag ("live", "DRAFT")
│   ├── badge.py              # Badge: state / risk / severity / validation chips
│   ├── kv_grid.py            # KeyValueGrid: label/value rows (status, manifest, approval, finding)
│   ├── top_bar.py            # TopBar (replaces SessionBar)
│   ├── fkey_bar.py           # FKeyBar
│   ├── activity_log.py       # ActivityLog
│   ├── chat/                 # assistant_log.py, chat_line.py, result_card.py, banner.py
│   ├── status/               # status_panel.py, phase_bars.py, counter_tiles.py, pipeline_strip.py
│   └── (kept) prompt.py, history.py, choice_menu.py
└── screens/
    ├── dashboard.py          # the one main screen
    ├── help.py, command_bar.py, choice.py   # kept, updated
    └── dialogs/
        ├── base.py           # DialogScreen
        ├── template.py, scope_manifest.py, secure_input.py, approval.py,
        └── findings.py, report.py, summary.py, activity.py
```

Removed: `screens/start.py, scope.py, plan.py, approval.py, execution.py,
findings_list.py, finding_detail.py, report.py`, `FlowProgress`, `widgets/question.py`
(if nothing else uses it).

## 6. Keys

| Key | Action |
| --- | --- |
| `Enter` | send the prompt / press the focused button / pick the highlighted row |
| `↑` `↓` | move in menus, tables and the prompt history |
| `←` `→` | move between buttons or format cards in a dialog |
| `Tab` | switch focus: prompt → assistant → status → activity log |
| `Esc` | close a dialog with its safe choice, clear the prompt |
| `F2` `F3` `F4` `F5` | Findings · Scope · Activity · Generate Report |
| `/` | command bar (`/findings`, `/scope`, `/activity`, `/report`, `/new`, `/help`, `/quit`) |
| `?` | shortcuts for what is on screen |
| `Ctrl+Q` | quit |

## 7. Theme

The current tokens already match the video's palette (cyan accent, teal/green for OK,
amber for warnings, red for blocked). New tokens go into **both** `theme.py` and
`reconix.tcss`: banner backgrounds (`$block-bg`, `$warn-bg`, `$ok-bg`) and the activity-log
source colours (SYS, AI, USER, TOOL, POLICY).

The terminal can't copy the video's smooth fades or its browser fonts. Dialogs dim the
dashboard behind them, bars fill in steps, and the look depends on the terminal font
(JetBrains Mono recommended, as today).

## 8. Build order

Each step leaves the app running and `pytest` green.

1. **Data**: new models, store functions and the video's scenario in `seed.py`, with store
   tests: scope gate, policy block, vault never leaks, HIGH needs phrase + reason.
2. **Dashboard skeleton**: Panel, Badge, KeyValueGrid, TopBar, StatusPanel, ActivityLog,
   AssistantLog, FKeyBar showing the store's current state. The dashboard replaces Start.
3. **Controller + first gates**: Template and Scope Manifest dialogs; Testing animation;
   blocked request.
4. **Secure input** and the vault.
5. **Approvals**: MEDIUM and HIGH dialogs.
6. **Findings, Report, Summary, Activity** dialogs; F-keys, slash commands, help.
7. **Clean-up**: delete the old screens, rewrite the old flow tests, update README and
   CLAUDE.md, then run the `security-reviewer` and `code-reviewer` subagents.

## 9. Changed while building

What was built differs from sections 1–8 in these points:

- **Esc on a gate dialog means "decide later", not "the safe choice".** Nothing runs
  while a gate waits, so closing it is already safe; Reject stays an explicit button
  (it stops the run). Enter on the empty prompt, or F3 at the scope gate, reopens it.
- **Safe first focus.** Scope opens on Edit Scope, approvals on Reject, HIGH on the
  phrase field. The video highlights Approve; this keeps a stray Enter from approving.
- **The vault chip says "SESSION VAULT", not "ENCRYPTED".** The demo vault is in
  memory and not encrypted; the label changes when the backend vault exists.
- **Colors live only in `theme.py`.** `ReconixApp.get_css_variables()` feeds
  `theme.CSS_TOKENS` to the stylesheets, so tokens are no longer duplicated in TCSS.
  The stylesheet is split into `styles/base.tcss`, `dashboard.tcss`, `dialogs.tcss`.
- **Badges are a helper, not a widget**: `theme.chip()`, `severity_chip()`, `risk_chip()`.
- **Edit Scope** records the operator's note (`store.request_scope_change`) and
  reopens the manifest; the demo manifest itself does not change.
- **Narrow terminals** (< 120 columns) stack the side column under the chat and the
  main area scrolls.

## 10. Decided after review

1. **Report files**: Generate Report writes real **JSON** and **Markdown** files to
   `./reports/` (standard library only). PDF and DOCX cards are shown dimmed
   "(not in demo)" until a dependency is added.
2. **Templates other than Web URL** (Network, API, Source Code) are shown dimmed
   "(not in demo)" until they have scenario data.
