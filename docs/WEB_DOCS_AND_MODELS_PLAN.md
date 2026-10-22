# Web: docs in the dashboard's style, and a configurable AI Assistant model

Status: in progress (2026-10-22). Branch `modify_local_web`.

## 0. Branding

- The logo stays as it is (the 3×3 grid in `sidebar.tsx`, `app/icon.svg`): the owner's call.
- The operator initials badge left the top bar (7f28bea). Nothing else showed it.

## 1. Documentation in the dashboard's style

The docs (`/docs`, `components/docs-*.tsx`, `styles/docs.css`, `site-nav.tsx`,
`site-footer.tsx`) still look like the old marketing site. They move to the dashboard's look:
the same tokens, type scale, surfaces (`dash-card`), borders, radii, icon buttons, badges,
focus rings and spacing as the views at `/`.

Done (2026-10-22): the docs are one more tab of the local viewer, not a separate site. Every
`/docs/**` page renders inside the dashboard's frame (`app/docs/layout.tsx`): the same sidebar
(its views are links back to `/?view=…`, its Documentation item marked), a docs top bar with the
way back to the dashboard, and `.dash-content` as the scroller. The old site chrome (`site-nav`,
`site-footer`, nav menus, scroll progress, `site.css`) and Lenis are gone: the docs scroll
natively like the dashboard. Cards use `.dash-card`.

Kept: every address (`DOCS_NAV`, `DOCS_ROUTES`, the `DOCS` link map, the 308 redirects), the
content in `content/docs/`, the generated `commands.json`, docs search, the table of
contents, the viewer check, native-scroll rules for the dashboard,
dark only, colours only from tokens. Responsive: sidebar → drawer on phones, no horizontal
scroll at 360 px.

## 2. AI Assistant: several providers and models

Today one model comes from `web/.env.local` (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`).

- **Providers**: a name, an OpenAI-compatible base URL (presets: Ollama, LM Studio, OpenAI,
  OpenRouter, Groq, custom), an optional API key and a list of model names. Add, edit,
  remove; add or remove models; "Test connection"; "Fetch models" (`GET {base}/models`).
- **Active model**: one provider + model, switched from the assistant header in one step.
- **Environment provider**: the `LLM_*` model shows as a read-only provider and stays the
  default while nothing is saved, so today's setup keeps working.
- **Storage**: `~/.reconix/assistant/models.json` (dir 0700, file 0600, atomic write). API
  keys are AES-256-GCM encrypted with a key in `~/.reconix/assistant/models.key` (0600).
  Keys never go back to the browser (only "key saved: yes/no"), never logged.
- **Rules (same as `modelSetup`)**: http(s) only, no credentials in the URL, a model name
  matching the existing pattern, a key only over https to a remote host, and an address off
  this machine only when the server runs with `LLM_ALLOW_REMOTE=1` (the browser can't turn
  that on). Fetches use `redirect: "error"`, a timeout and no cache.
- **Access**: the routes live under `/api/assistant/models…`, so the proxy's operator check
  covers them (the only role that signs in while the terminal is hosted); handlers check
  again, and writes also check the Origin (`lib/auth/origin.ts`).

## 3. Figma

After the web UI is merged, the Figma file "Local Web UI (Copy)" is updated to match: the
docs pages, the assistant's model switcher and model settings, and the top bar without the
operator badge.

## 4. Checks

`npm run lint`, `npm run typecheck`, `npm test` (vitest), Playwright where a Chromium is
available; phone and desktop widths. Known Windows-only failures in `tests/data` (path
separators, symlinks, FIFOs) predate this work.
