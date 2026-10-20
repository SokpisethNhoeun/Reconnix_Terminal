/* Masking secrets an operator might paste into a question (a cookie, a bearer token, a URL with
   a password), before it is shown, kept in the tab, resent or sent to the model. The same
   patterns as the TUI's reconix/store/redact.py; tests/redact-vectors.json holds cases both
   test suites check, so the two stay in step. Pure: the browser and the server both use it. */

export const MASK = "••••";

const PATTERNS: [RegExp, string][] = [
  // https://user:password@host → https://••••@host
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^/\s@:]+:[^/\s@]*@/gi, `$1${MASK}@`],
  // Cookie: …, Authorization: …, password=…, api_key: "…" → keep the name, mask the value
  [
    /\b((?:set-)?cookie|(?:proxy-)?authorization|password|passwd|pwd|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|access[_-]?key|session[_-]?id|sessionid)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi,
    `$1$2${MASK}`,
  ],
  [/\bbearer\s+[a-z0-9._~+/=-]{8,}/gi, `Bearer ${MASK}`],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, `${MASK} (JWT)`],
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, `$1${MASK}`],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, `${MASK} (private key)`],
];

/** `text` with credentials, tokens and keys masked. */
export function redact(text: string): string {
  return PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
