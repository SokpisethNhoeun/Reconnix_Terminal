# API template: one form for the base URL and the spec

Status: in progress (2026-10-22). Branch `r11/api-form` off `feature/next-update`. Follows
`API_SCHEMA_FOR_AI_PLAN.md`, where the form already opens on its own.

## Owner's decisions

- **One form when the API template is chosen.** The form that opens on its own, and again from
  the Scope menu's Attach / Replace, has:
  - **API base URL**: prefilled from the draft scope's target.
  - **OpenAPI spec (optional)**: a file path, or an `https://` URL.
  - Leave the spec empty to keep only the base URL.
- **The base URL may change the target before scope approval.** The store validates it with the
  same rules as a typed target, then re-drafts the API scope for the new target; the manifest you
  approve shows it. After approval the form is not offered, as today.
- **A spec URL is downloaded only from the API's own host.**
  - The host must be the target's host. Over `https`, or `http` only for localhost / 127.0.0.1.
  - At most 5 MB, no redirects, a 10 s timeout, read only.
  - Audit-logged: `api_spec.fetched` with the host and path, never the query.
  - The same checks as a file then apply: OpenAPI 3 / Swagger 2, redacted, and it never widens
    the scope.
  - The fetch runs in a worker, as the file read does.

## The form (exact text)

- **Title:** `⇡ API TEMPLATE: BASE URL AND SPEC`. **Chip:** `Scope`.
- **Fields:**
  - `API base URL`, placeholder `https://api.example.com`
  - `OpenAPI spec (optional)`, placeholder `~/specs/openapi.yaml or https://api.example.com/openapi.json`
- **Note:** `The spec is only read, never run, and never widens the scope. A spec URL must be on
  the API's own host.`
- **Buttons:** Submit `Save`, and `Cancel`. **Footer:**
  `Leave the spec empty to skip it · Esc to cancel`.
- **Errors**, from the store, shown in the form:
  - `The spec URL must be on <host>.`
  - `The spec URL must use https.`
  - `Couldn't download the spec: <reason>.`
  - the existing file and parse errors

## Checks

- `pytest -q` and ruff:
  - URL validation: a foreign host, plain http, a redirect, too large, a timeout. Use a local
    test server, never a real network.
  - The target change re-drafts the scope; refused after approval.
  - The Pilot form flow.
- TUI Figma file: `F:openapi` becomes this form, with its error state.
