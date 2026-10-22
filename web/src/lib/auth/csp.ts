/* The Content-Security-Policy every response carries (set by src/proxy.ts). Scripts need the
   per-request nonce; nothing may frame any page or route (every export is a download, and the
   combined report's preview is handed to its sandboxed frame as `srcDoc`, never framed by URL).
   While the dashboard hosts the terminal, pages may also connect to its helper on 127.0.0.1 — on
   every page, because a client-side navigation to /terminal keeps the policy of the page it
   started on. */
import { terminalEnabled, terminalSocketOrigin } from "../terminal/config";

export function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // inline style attributes (bar widths, charts)
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${terminalEnabled() ? ` ${terminalSocketOrigin()}` : ""}${dev ? " ws:" : ""}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
