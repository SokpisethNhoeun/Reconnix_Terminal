# Reconix analysis dashboard (web)

A local dashboard for what the Reconix terminal app did, opened from the TUI with `/web`. It
reads the assessments the TUI saves to `~/.reconix/assessments/` and shows them as the
**Assessment Operations Center** (the globe UI from the reconix-web-ui site), with Assessments,
Findings, Reports, Scope, Terminal and AI Assistant views, all switched in-page (`?view=`;
each view's own address keys and every run link live in `components/dashboard/view-url.ts`).
By default the Overview totals **every saved run** (`derive-overall.ts`) and Findings lists
them all, each naming its run; the Assessment switcher in the top bar opens one run instead
(`?uid=`) and searches every saved run. Scope belongs to one run, so with every run shown it
asks you to pick one; Reports then lists every run and combines them. The page re-reads the
files every 10 s (`RECONIX_LIVE_REFRESH_MS`; `0` turns it off).

- **Overview:** a summary strip (Findings with the worst severity, Assessment progress with its
  state, Tool execution, Duration against the time limit) over the globe hero with the Ask bar;
  three panels: **Findings by Severity** (a stacked bar, one row per severity, review state,
  top CVSS findings), the **Activity Timeline** (lanes by kind with clustered marks that expand,
  masked text; with every run shown, runs per day stacked by status) and the **Execution
  Timeline** (a row per plan step, a shared tool track and the waiting gate; with every run
  shown, the newest 8 runs).
- **Meanings:** every status, step, approval, policy decision and severity is a badge with an
  icon, a label and a tooltip from `lib/status.ts` (`components/ui/status-badge.tsx`); severity
  uses the TUI's own scale. Colour is never the only signal; every chart has a legend.
- **Assessments:** every saved run, newest first, ten a page, with a search and status and
  template chips (`?view=assessments&q=api&status=Completed&template=API&page=2`); a row opens
  that run's Overview.
- **Findings** filter by severity and validation and search title, ID, CWE and target, ten
  rows a page with Previous / Next; the filters, the page and the open finding live in the
  address (`?sev=HIGH,LOW&val=review&q=sql&page=2&finding=F-001`), so a link opens on its
  finding's page. The finding's evidence and remediation sit beside the list; on the fixed
  desktop frame the list scrolls on its own under the filters, and on a phone the list and the
  detail take turns (Back returns to the list). Ten rows a page is `lib/paging.ts`, shared with
  Assessments and the Report view's runs.
- **Drill-down:** the Findings card opens every finding, a severity row opens Findings filtered
  to it, a top finding opens itself.
- **The bell** lists what the open run waits on and every other saved run that waits on a
  decision; the switcher says when a saved file was skipped and why. Those views never change
  anything. The **Terminal** view runs the TUI itself in the browser, so every gate and
  decision still goes through the TUI's store. `/docs` holds the project's documentation
  (`lib/docs-nav.ts` over `content/docs/`: getting started, the terminal guide, AI models, one
  page per command, the assessment guide, reports, troubleshooting, guardrails; a search; the
  addresses of the previous structure redirect, 308, through `lib/docs-redirects.ts`).
  (The Audit log view was removed; the audit data stays in the saved files and the TUI.)

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · GSAP · Lenis ·
three.js · zod · lucide-react. Dark only. See `../docs/WEB_GLOBE_UI_PLAN.md` for how it
replaced the earlier pages, `../docs/WEB_REDESIGN_V2_PLAN.md` for the v2 redesign and
`../docs/WEB_REDESIGN_V3_PLAN.md` for v3 (Assessments, paging, the combined report, the docs;
§5 holds its status).

## Run

```bash
npm ci
npm run build
npm start                          # http://127.0.0.1:3100, prints and opens the sign-in link
RECONIX_DATA_DIR=sample-data npm start   # the sample assessments instead of your own
npm start -- --no-open             # don't open a browser
npm start -- --no-terminal         # no Terminal page; the sign-in grants viewer only
```

| Variable | Default | Meaning |
|---|---|---|
| `RECONIX_DATA_DIR` | `~/.reconix/assessments` | the folder the TUI saves to |
| `RECONIX_STALE_AFTER_HOURS` | `12` | an unfinished run whose file has not changed for this long reads as Interrupted (its TUI was killed before it could say so); `0` turns this off, e.g. for the old sample data |
| `RECONIX_LIVE_REFRESH_MS` | `10000` | how often the page re-reads the saved files; `0` turns the live refresh off (the e2e server does) |
| `RECONIX_CHROME` | the usual names on PATH, then the common install paths | the Chrome/Chromium that prints the PDF exports; without one the PDF routes answer 501 |
| `RECONIX_WEB_PORT` | `3100` | port on 127.0.0.1 |
| `RECONIX_TERM_PORT` | `3101` | the terminal helper's port on 127.0.0.1 |
| `RECONIX_PYTHON` | repo `.venv`, else `python3` (`python` on Windows) | the Python that runs the terminal helper and the TUI |
| `RECONIX_WEB_TOKEN` | random per start | only for tests; normally `scripts/serve.mjs` makes one |

## Terminal page

`scripts/serve.mjs` starts `python -m reconix.webterm` (from the repo root) next to Next.js.
The page asks `POST /api/terminal/ticket` for a single-use ticket valid for 60 s, then opens
`ws://127.0.0.1:3101/?ticket=…`.

- **Ticket route:** same origin, the operator session cookie **and** the terminal key
  cookie (`reconix_term`, `Path=/api/terminal`, signed differently, so a session cookie
  seen by another server on 127.0.0.1 can't mint tickets). It returns the ticket, the
  socket URL and the `proof` the real helper will send.
- **Helper:** checks the `Host` (loopback), the `Origin` (this dashboard) and the ticket
  (signed with the launch token, used once). Its first frame is `{"type":"hello","proof"}`;
  the page sends nothing and shows nothing until it matches, so another program holding
  port 3101 gets no keystrokes. Then it runs `python -m reconix` on a pseudo-terminal that
  is the TUI's controlling terminal: if the helper dies, so does the TUI. On Windows it is
  a ConPTY pseudo console (`pywinpty`) the helper owns; closing it ends the TUI.
- **Frames:** binary for terminal bytes (pastes split into 32 KiB), text for
  `{"type":"resize","cols","rows"}` (at most 256 characters).
- **Limits:** 2 sessions at once; one closes after 30 minutes without typing. The Terminal
  view is mounted on its first visit and then only hidden (`components/dashboard/viewer.tsx`),
  so the session keeps running while you switch views and through the live refresh; closing
  the tab stops that TUI. Nothing typed is logged.
- **Controls:** copy (the selection, else the terminal's text), clear (wipes the screen;
  a same-size resize message has the TUI repaint it), restart (asks first while a session
  is live), expand (fills the browser window, so Esc still reaches the TUI), and "↓ Latest"
  while scrolled up. None of them sends keystrokes.
- **The sign-in link** grants operator control, so `serve.mjs` prints it only to a
  terminal; started by the TUI, it is only in `~/.reconix/web.url` (0600).

## AI Assistant

The Overview's Ask bar and the sidebar's **AI Assistant** tab open the same chat
(`?view=assistant`; `/assistant` redirects there; one history entry, so Back returns).

- **Transition** (`components/assistant/motion.ts`, `MOTION`): about 1.6 s to open and 1.4 s to
  close on the fixed desktop frame. The top bar and summary strip go up, Findings by Severity
  right, the timelines down, all fading, while the surface grows from the hero box to the area
  beside the sidebar; the assistant's header, conversation and composer come in last. Phones,
  tablets and a direct load crossfade (0.3 s); reduced motion is a 0.22 s fade.
- **One globe:** the hero's three.js globe is carried into the assistant (never a second WebGL
  context; `use-globe.ts`) and sits behind the welcome at about 18 % opacity; once a
  conversation has messages it fades out and stops drawing (also when hidden, or on low-power
  devices, where it holds a still frame).
- **Breathing** (`breath.ts`, `styles/motion.css`): one 6 s cycle shared by the sidebar's AI
  icon and the globe/orb, started once the open has settled, on its own layer. Nothing that
  holds text breathes: the chat panel and its card are static once messages exist (scaled text
  vibrates while reading); reduced motion shows a still halo instead.

- **Model:** any OpenAI-compatible endpoint, as the product docs' "Model switching": set
  `LLM_BASE_URL` and `LLM_MODEL` in the environment `/web` starts from or in `web/.env.local`
  (git-ignored). A local Ollama: `LLM_BASE_URL=http://127.0.0.1:11434/v1`, `LLM_MODEL=llama3.2`.
  An endpoint off this machine also needs `LLM_ALLOW_REMOTE=1` (assessment data goes there; the
  screen says so) and takes `LLM_API_KEY` over https only. The key stays in the Next.js
  process: the terminal helper and the TUI it runs never get `LLM_*`. Unset, the screen says how.
- **Route:** `POST /api/assistant` takes `{ conversationId?, uid, question, retry? }`: operators
  only (proxy and handler), same origin, zod-checked, a byte cap, 12 questions a minute and 2
  replies at once (`RECONIX_ASSISTANT_RATE_PER_MINUTE`, `RECONIX_ASSISTANT_RATE_RUNNING`). The
  browser never sends history: the server reads it from the conversation file. It builds the
  model's context from the saved files itself (no evidence lines; every value one line with no
  `<`/`>` or invisible characters, cut, ≈14,000 characters at most) inside a fence with a new
  random tag per question, framed as untrusted data. The reply streams as NDJSON frames
  (`lib/assistant/protocol.ts`: `meta`, `card`, `text`, `error`, `done`).
- **Cards the server picks** (`lib/assistant/cards.ts`, `intent.ts`): findings, a finding,
  progress, approvals, policy blocks, tools used, report downloads and notices, built from the
  saved data only; the model writes the explanation and never the numbers. Nothing can be run
  or approved from the chat: approvals say "Decide in the TUI", with Open Terminal for
  operators. Questions are masked with the TUI's secret patterns (`lib/assistant/redact.ts`,
  vectors shared with `reconix/store/redact.py` in `tests/redact-vectors.json`).
- **Saved conversations** (`lib/assistant/history-store.ts`): one `<uuid>.json` per
  conversation in `~/.reconix/assistant/` (`RECONIX_ASSISTANT_DIR`; the folder `0700`, files
  `0600`, the parent not writable by others), written atomically, read like the saved
  assessments. A conversation keeps the run it began with; its title is the first question.
  History, rename, delete and "Delete all" through `/api/assistant/conversations[/<id>]`
  (operators; changes need the page's origin). Kept 30 days after last use
  (`RECONIX_ASSISTANT_RETENTION_DAYS`, `0` keeps them), at most 100 conversations and 200
  messages each. The tab keeps only the open conversation's id and the masked unsent draft.
  Plans: `docs/WEB_AI_ASSISTANT_PLAN.md`, `docs/WEB_REDESIGN_V2_PLAN.md` (the transition and
  the breathing), `docs/WEB_REDESIGN_V3_PLAN.md` (the v3 polish and its status).

## Develop

```bash
npm run dev          # hot reload, same sign-in flow
npm test             # vitest: data reader, schema, stats, session, dashboard numbers, filters
                     #   and paging, the docs structure and redirects, the combined report
npm run check:data   # print everything derive.ts computes from a saved file (default: the
                     #   newest in sample-data/, or pass a path)
npm run globe:points # rebuild public/globe/land.bin (dev only; the build doesn't run it)
npm run lint && npm run typecheck   # typecheck needs `npx next typegen` (or a build) first
npm run build && npm run e2e        # Playwright on sample-data (npx playwright install chromium,
                                    #   or CHROMIUM_PATH=/usr/bin/chromium); E2E_PORT moves its
                                    #   ports (default 3199, plus 3198 and 3195)
```

The e2e specs: `access` (roles, origin, headers), `pages` (views, switcher, downloads, the docs,
the Terminal view with a stand-in program), `assessments` (ten a page, the pager, chips, search,
the address), `findings` (paging, deep links, Previous / Next across a page end, the notice for
a hidden finding, the list scroller, the phone's list → detail → Back), `reports` (combining
runs: the selection, the preview frame, one real PDF and DOCX, the 500 / 501 / 413 paths),
`docs` (groups, command pages, Copy, search, redirects, the phone menu), `dashboard-fit` (the
Overview fits the fixed frame with nothing to scroll), `assistant` (with the stand-in model
`e2e/llm-stub.mjs`; `[stub:markdown]`, `[stub:long]` and `[stub:fail]` pick its answers), `motion` (directions,
timing, the globe, history), `scroll` (the wheel and keys at six sizes, no sideways scroll) and
`a11y` (axe via `@axe-core/playwright`, focus order). Known faults are listed in the specs as
expected failures that fail with "remove this entry" once fixed. The specs wait for
`html[data-hydrated]` (set by `components/dashboard/viewer.tsx`), never for network idle.

`sample-data/` is generated by `python scripts/make_sample_data.py` (repo root), which plays
at least a dozen runs across the four templates through the real TUI store (every severity,
runs with no findings, a run stopped before its scope was approved, one still running, one
with more than a page of findings), so it always matches the saved format; the specs read their
counts from it (`e2e/support.ts`), never from literals.

## Layout

```
src/
├── proxy.ts                 # Host allowlist, viewer role on every route, operator for the terminal, nonce CSP
├── app/
│   ├── layout.tsx           # fonts (Inter, JetBrains Mono), metadata (no Lenis: the dashboard scrolls natively)
│   ├── page.tsx             # the viewer: loads the saved runs, every run or ?uid=, derives the dashboard
│   ├── docs/                # documentation (layout checks the viewer role, mounts Lenis; content in src/content/docs/)
│   ├── terminal/            # /terminal → /?view=terminal (operators)
│   ├── assistant/           # /assistant → /?view=assistant
│   ├── login/               # sign-in (token from the link's #fragment) → the Overview
│   └── api/                 # session (sign-in), assessments/[uid] (JSON), assessments/[uid]/export,
│                            #   reports/combined (1–5 runs as one PDF / DOCX; viewer), terminal/ticket,
│                            #   assistant and assistant/conversations (operators)
├── lib/
│   ├── data/                # schema.ts (zod), store.ts (server-only reader), stats.ts (pure),
│   │                        #   adapt.ts (a saved run → the viewer's terms), view-types.ts, format.ts
│   ├── report/              # formats.ts (the export registry), html.ts (report), pdf.ts (Chrome), render.ts,
│   │                        #   combined/ (query.ts validates ?uids=&format=&evidence=&low=&appendix=,
│   │                        #   select.ts merges the runs, html.ts renders, options.ts names the file),
│   │                        #   docx/ (zip.ts, ooxml.ts, report.ts and combined.ts: the Word documents)
│   ├── auth/                # session.ts (launch token, signed cookie, roles, hosts), csp.ts, guard.ts
│   │                        #   (+ terminalAccess), origin.ts (same-origin check), ticket.ts (terminal tickets)
│   ├── terminal/            # config.ts (on/off, helper port), paths.ts, protocol.ts (frames, close codes),
│   │                        #   screen-text.ts (what Copy output copies)
│   ├── assistant/           # config.ts (the model), request.ts (zod), context.ts (what the model sees),
│   │                        #   prompt.ts, llm.ts + stream.ts + reply.ts (the streamed reply), protocol.ts
│   │                        #   (NDJSON frames), intent.ts + cards.ts + insights.ts + prompts.ts (cards and
│   │                        #   prompts from saved data), history-store.ts + history-schema.ts (saved
│   │                        #   conversations), redact.ts, markdown.ts, rate.ts, access.ts, client.ts
│   ├── scroll/              # stick-rules.ts + stick-controller.ts (the conversation follows its end)
│   ├── scroll.ts            # scrolling a row into view by hand (never scrollIntoView, which moves the page)
│   ├── paging.ts            # ten rows a page: the page clamped from the address, the label
│   ├── status.ts            # what every status, step, approval, policy decision and severity means
│   ├── docs-nav.ts          # DOCS_NAV / DOCS_ROUTES / the DOCS link map, and the commands from commands.json
│   ├── docs-redirects.ts    # the old docs addresses → the new pages (308, loaded by next.config.ts)
│   ├── docs-search-index.ts # what the docs search looks through (titles, headings, aliases)
│   └── globe*.ts (three.js globe: scene, post, holds), site.ts, templates.ts, utils.ts
├── components/
│   ├── dashboard/           # Viewer, Sidebar, TopBar, the views, the summary strip and the three panels;
│   │                        #   derive*.ts hold every number they show (overview-types.ts); axis.ts,
│   │                        #   event-kinds.ts, legend.tsx, hint.tsx, chart-tooltip.tsx, mark-details.tsx;
│   │                        #   view-url.ts (?view=, each view's keys, run links), live-refresh.tsx,
│   │                        #   intro.tsx (GSAP, by data-motion); the Assessments view (assessments-*.ts(x)),
│   │                        #   Findings (findings-view/-list.tsx, finding-detail.tsx, filters.ts, filter-bar.tsx),
│   │                        #   Reports (reports-view.tsx, report-selection/-runs/-preview.tsx, derive-report.ts),
│   │                        #   run-cells.tsx (the one run row of Assessments and Reports), view-header.tsx,
│   │                        #   view-link.tsx and run-link.tsx (drill-downs), docs-search.tsx
│   ├── assistant/           # AssistantProvider (+ use-* hooks: open, asking, history, tab memory),
│   │                        #   AssistantStage + motion*.ts + use-globe*.ts (the transition and the globe),
│   │                        #   AssistantView, header, welcome, prompt cards, messages, cards/, composer,
│   │                        #   conversation menu, breath.ts, use-stick-to-bottom.ts + scroll-to-bottom.tsx
│   ├── terminal/            # TerminalView, TerminalPanel, TerminalToolbar, RestartButton, TerminalNotice,
│   │                        #   ScrollToLatest, useXterm, useTerminalSession, useTerminalView, useLeaveWarning
│   ├── ui/                  # Button, Badge, StatusBadge / SeverityBadge, IconButton, Checkbox, CopyButton,
│   │                        #   Pagination, ListDetail, EmptyNote (cva + cn; styles/ui.css)
│   └── docs-*.tsx, site-nav.tsx, site-footer.tsx, nav-*.ts(x)   # the docs' chrome
├── content/docs/            # the documentation pages, one file per group; commands.json is GENERATED from
│                            #   reconix/commands/builtin.py by scripts/export_commands.py (never edit it:
│                            #   tests/test_export_commands.py and tests/docs-nav.test.ts check it)
└── styles/                  # tokens.css (GENERATED from reconix/theme.py by scripts/export_tokens.py), then one
                             #   file per area, imported in this order from app/globals.css: frame (page and
                             #   scrolling), dashboard, motion, terminal, site, assistant, ui (shared controls),
                             #   findings, assessments, reports, docs
public/globe/land.bin        # the globe's land dots (scripts/build-globe-points.mjs)
```

## Exports

The Reports view's **Download** row offers PDF, JSON and DOCX (the same three the TUI saves),
straight from `/api/assessments/<uid>/export?format=…`. The PDF is printed by a Chrome/Chromium
on the dashboard machine (`RECONIX_CHROME` names one); without a browser the route says so and
links the Word document. Every format is a download, and no route may be framed. The DOCX is
written by `lib/report/docx/` (no dependency: a stored ZIP of the document and its styles, every
value XML-escaped, one run per value and a size cap). All formats come from the saved,
already-masked data; `lib/report/formats.ts` is the single list of formats.

With every run shown, the Reports view's **Combine runs** panel picks up to five saved runs,
previews them as one report (the same HTML the PDF prints, in a sandboxed frame: a preview, never
a download) and generates one PDF or one DOCX from
`/api/reports/combined?uids=a,b&format=pdf|docx|preview&evidence=1&low=1&appendix=1` (without a
printer the PDF answers 501 and the panel offers the DOCX; a Word document past `DOCX_MAX_MIB` of
text answers 413, on the single export too)
(`lib/report/combined/`). A finding with the same title, CWE and target in several runs counts
once, with each run as an occurrence; what a run lacks is listed under Limitations.

## Rules

- **Read-only for assessments.** No route writes, deletes or starts anything the TUI reads;
  decisions belong in the TUI. Two exceptions: the Terminal page runs the TUI itself (its
  ticket route only hands out a ticket; the helper starts the session), and the AI Assistant
  writes **its own conversation files** in `~/.reconix/assistant` (and nothing else). The
  assistant's route is also the one place saved data leaves the machine, and only to the model
  the operator configured. The PDF exports (single and combined) start a headless Chrome on a
  temp file the server wrote (`lib/report/pdf.ts`), never on anything the request said.
- **One data source.** Pages read through `lib/data/store.ts` only; it accepts regular files
  named `<YYYYMMDD-HHMMSS-xxxx>_<id>.json` up to 5 MB that pass `AssessmentSchema`.
  Change `schema.ts` together with `reconix/store/snapshot.py`.
- **Access.** Every page and route needs the `viewer` role, and `/terminal`,
  `/api/terminal/*` and `/api/assistant` (with everything under it) need `operator` (`proxy.ts`, and pages / handlers check again; the
  page renders the Terminal view only for operators). The
  sign-in link grants `operator` while the terminal is on (`--no-terminal`: `viewer`). The
  dashboard binds to 127.0.0.1 and refuses other Host headers; so does the terminal helper.
- **Text is text.** Saved values (targets, evidence, chat) and the model's replies are
  rendered by React as text (`MessageText` turns a small markdown subset into elements);
  never use `dangerouslySetInnerHTML`.
- **Colors** come only from `tokens.css`; add a token in `reconix/theme.py` (`WEB_TOKENS`)
  and re-run `scripts/export_tokens.py`. No stylesheet holds colour literals. Meanings come
  from `lib/status.ts` (teal = AI and progress, green = done, amber = waiting or to review,
  red = errors and blocked, slate = informational; severity on the TUI's scale).
- **Scrolling.** Lenis smooth scrolling only on the docs pages; the dashboard scrolls
  natively. On the fixed desktop frame (≥1280×760) `.dash-content` is the one scroller,
  elsewhere the window; never `overflow: hidden` on the page to fix scrolling.
- **Numbers come from the saved run.** Every value on the dashboard is computed in
  `components/dashboard/derive*.ts` from `lib/data/adapt.ts`, and every number on an assistant
  card in `lib/assistant/cards.ts`; components hold no literal numbers, and nothing the snapshot
  doesn't record is shown (there is no "failed" state: the data has none).
- **Motion hooks.** The transition and the intro find the Overview's groups by
  `data-motion` (`top`, `hero`, `fade`, `right`, `bottom`), never by class names; the
  assistant view keeps `data-assistant-piece` on its header, conversation and composer, and
  the welcome's `data-globe-slot`.
- **Filters are client-side** over data the page already has (`components/dashboard/filters.ts`,
  `assessments-filters.ts`, `lib/paging.ts`; unit-tested, and anything unknown in the address
  is ignored or clamped); they never add a route or a request.
- **No inline scripts.** The intro's hide-before-animate state is CSS
  (`@media (scripting: enabled)`), so the nonce CSP needs no exceptions.
- **Reusable components** in `components/dashboard` (DashCard, Popover, …) and `components/ui`
  before new markup.
- **Severity colors** always sit next to the severity name (never color alone).
