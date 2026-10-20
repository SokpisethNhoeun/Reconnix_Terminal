# Reconix analysis dashboard (web)

A local dashboard for what the Reconix terminal app did, opened from the TUI with `/web`. It
reads the assessments the TUI saves to `~/.reconix/assessments/` and shows them as the
**Assessment Operations Center** (the globe UI from the reconix-web-ui site): an Overview
with a three.js globe, activity and execution timelines, progress, tool steps and findings
by severity, plus Findings, Audit log, Reports and Scope views, all switched in-page
(`?view=`). By default the Overview totals **every saved run** (`derive-overall.ts`) and
Findings lists them all, each naming its run; the Assessment switcher in the top bar opens one
run instead (`?uid=`) and searches every saved run. Audit log, Reports and Scope belong to one
run, so with every run shown they ask you to pick one. The page re-reads the files every 10 s.

- **Findings** filter by severity and validation and search title, ID, CWE and target; the
  filters and the open finding live in the address (`?sev=HIGH,LOW&val=review&q=sql&finding=F-001`).
- **Audit log** filters by kind and author and searches text and time (`?kind=&who=&aq=`).
- **Drill-down:** the Overview's severity tiles, top findings and the Findings, Policy checks
  and Blocked-by-policy numbers open the matching filtered view.
- **The bell** lists what the open run waits on and every other saved run that waits on a
  decision; the switcher says when a saved file was skipped and why. Those views never change anything. The
**Terminal** view runs the TUI itself in the browser, so every gate and decision still goes
through the TUI's store. `/docs` holds the project's documentation.

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · GSAP · Lenis ·
three.js · zod · lucide-react. Dark only. See `../docs/WEB_GLOBE_UI_PLAN.md` for how it
replaced the earlier pages.

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
(`?view=assistant`; `/assistant` redirects there). The dashboard animates into it: the top bar,
left card, right column and bottom row slide out, and the globe/Ask-bar area grows into the
chat (desktop frame; elsewhere and with reduced motion it fades). Values to tune live in
`components/assistant/motion.ts` (`MOTION`) and the 4 s breathing loops in `globals.css`.

- **Model:** any OpenAI-compatible endpoint, as the product docs' "Model switching": set
  `LLM_BASE_URL` and `LLM_MODEL` in the environment `/web` starts from or in `web/.env.local`
  (git-ignored). A local Ollama: `LLM_BASE_URL=http://127.0.0.1:11434/v1`, `LLM_MODEL=llama3.2`.
  An endpoint off this machine also needs `LLM_ALLOW_REMOTE=1` (assessment data goes there; the
  screen says so) and takes `LLM_API_KEY` over https only. The key stays in the Next.js
  process: the terminal helper and the TUI it runs never get `LLM_*`. Unset, the screen says how.
- **Route:** `POST /api/assistant`, operators only (proxy and handler), same origin, zod-checked
  body (the run in scope and at most 30 turns), 12 questions a minute and 2 replies at once.
  The server builds the model's context from the saved files itself (no evidence lines; every
  value one line with no `<`/`>` or invisible characters, cut, ≈14,000 characters at most) inside
  a fence with a new random tag per question, framed as untrusted data, and streams the reply
  back as text. Questions are masked with the TUI's secret patterns (`lib/assistant/redact.ts`,
  vectors shared with `reconix/store/redact.py` in `tests/redact-vectors.json`). Nothing is
  written or logged.
- **Conversation:** one per tab (`sessionStorage`), shared by the Ask bar and the composer,
  kept across views, the live refresh and reloads; only the turns about the same run go back
  to the model with a question. Plan: `docs/WEB_AI_ASSISTANT_PLAN.md`.

## Develop

```bash
npm run dev          # hot reload, same sign-in flow
npm test             # vitest: data reader, schema, stats, session, dashboard numbers
npm run check:data   # print everything derive.ts computes from a saved file (default: the
                     #   newest in sample-data/, or pass a path)
npm run globe:points # rebuild public/globe/land.bin (dev only; the build doesn't run it)
npm run lint && npm run typecheck   # typecheck needs `npx next typegen` (or a build) first
npm run build && npm run e2e        # Playwright on sample-data (npx playwright install chromium,
                                    #   or CHROMIUM_PATH=/usr/bin/chromium)
```

`sample-data/` is generated by `python scripts/make_sample_data.py` (repo root), which plays
the four templates through the real TUI store, so it always matches the saved format.

## Layout

```
src/
├── proxy.ts                 # Host allowlist, viewer role on every route, operator for the terminal, nonce CSP
├── app/
│   ├── layout.tsx           # fonts (Inter, JetBrains Mono), Lenis, metadata
│   ├── page.tsx             # the viewer: loads the saved runs, every run or ?uid=, derives the dashboard
│   ├── docs/                # documentation (layout checks the viewer role; content in src/content/docs/)
│   ├── terminal/            # /terminal → /?view=terminal (operators)
│   ├── assistant/           # /assistant → /?view=assistant
│   ├── login/               # sign-in (token from the link's #fragment) → the Overview
│   └── api/                 # session (sign-in), assessments/[uid] (JSON), assessments/[uid]/export,
│                            #   terminal/ticket and assistant (operators)
├── lib/
│   ├── data/                # schema.ts (zod), store.ts (server-only reader), stats.ts (pure), export.ts,
│   │                        #   adapt.ts (a saved run → the viewer's terms), view-types.ts, format.ts
│   ├── report/              # formats.ts (the export registry), html.ts (report), pdf.ts (Chrome), render.ts
│   ├── auth/                # session.ts (launch token, signed cookie, roles, hosts), csp.ts, guard.ts
│   │                        #   (+ terminalAccess), origin.ts (same-origin check), ticket.ts (terminal tickets)
│   ├── terminal/            # config.ts (on/off, helper port), paths.ts, protocol.ts (frames, close codes),
│   │                        #   screen-text.ts (what Copy output copies)
│   ├── assistant/           # config.ts (the model, server only), request.ts (zod), context.ts (what the
│   │                        #   model sees), prompt.ts, llm.ts + stream.ts (streamed reply), rate.ts, paths.ts
│   └── globe.ts (three.js globe), docs-nav.ts (the docs structure), site.ts, templates.ts, utils.ts
├── components/
│   ├── dashboard/           # Viewer, Sidebar, TopBar, the views, cards and charts; derive.ts holds every
│   │                        #   number they show; view-url.ts (?view=), live-refresh.tsx, intro.tsx (GSAP)
│   ├── assistant/           # AssistantProvider (conversation), AssistantStage + motion.ts (the transition),
│   │                        #   AssistantView, Composer, MessageText, AssistantOrb, breath.ts
│   ├── terminal/            # TerminalView, TerminalPanel, TerminalToolbar, RestartButton, TerminalNotice,
│   │                        #   ScrollToLatest, useXterm, useTerminalSession, useTerminalView, useLeaveWarning
│   ├── ui/                  # Button, Card, Badge, StatusChip, IconButton (cva + cn)
│   └── docs-*.tsx, site-nav.tsx, site-footer.tsx, nav-*.ts(x)   # the docs' chrome
├── content/docs/            # the documentation pages
└── styles/tokens.css        # GENERATED from reconix/theme.py (scripts/export_tokens.py)
public/globe/land.bin        # the globe's land dots (scripts/build-globe-points.mjs)
```

## Exports

The Reports view's **Download** row offers PDF, HTML, JSON, CSV and SARIF, straight from
`/api/assessments/<uid>/export?format=…`. The PDF is printed by a Chrome/Chromium on the
dashboard machine (`RECONIX_CHROME` names one); without a browser the route says so, and
the HTML report can be printed to PDF from any browser. All formats come from the saved,
already-masked data; `lib/report/formats.ts` is the single list of formats.

## Rules

- **Read-only, except the Terminal page.** No route writes, deletes or starts anything;
  decisions belong in the TUI. The one exception is the Terminal page, which runs the TUI
  itself (its ticket route only hands out a ticket; the helper starts the session). The AI
  Assistant's route writes nothing either; it is the one place saved data leaves the machine,
  and only to the model the operator configured.
- **One data source.** Pages read through `lib/data/store.ts` only; it accepts regular files
  named `<YYYYMMDD-HHMMSS-xxxx>_<id>.json` up to 5 MB that pass `AssessmentSchema`.
  Change `schema.ts` together with `reconix/store/snapshot.py`.
- **Access.** Every page and route needs the `viewer` role, and `/terminal`,
  `/api/terminal/*` and `/api/assistant` need `operator` (`proxy.ts`, and pages / handlers check again; the
  page renders the Terminal view only for operators). The
  sign-in link grants `operator` while the terminal is on (`--no-terminal`: `viewer`). The
  dashboard binds to 127.0.0.1 and refuses other Host headers; so does the terminal helper.
- **Text is text.** Saved values (targets, evidence, chat) and the model's replies are
  rendered by React as text (`MessageText` turns a small markdown subset into elements);
  never use `dangerouslySetInnerHTML`.
- **Colors** come only from `tokens.css`; add a token in `reconix/theme.py` (`WEB_TOKENS`)
  and re-run `scripts/export_tokens.py`. `globals.css` holds no colour literals.
- **Numbers come from the saved run.** Every value on the dashboard is computed in
  `components/dashboard/derive.ts` from `lib/data/adapt.ts`; components hold no literal
  numbers, and nothing the snapshot doesn't record is shown.
- **Filters are client-side** over data the page already has (`components/dashboard/filters.ts`,
  unit-tested); they never add a route or a request.
- **No inline scripts.** The intro's hide-before-animate state is CSS
  (`@media (scripting: enabled)`), so the nonce CSP needs no exceptions.
- **Reusable components** in `components/dashboard` (DashCard, Popover, …) and `components/ui`
  before new markup.
- **Severity colors** always sit next to the severity name (never color alone).
