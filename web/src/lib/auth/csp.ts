/* The Content-Security-Policy every response carries (set by src/proxy.ts). Scripts need the
   per-request nonce; nothing may frame the dashboard, except that the export route's HTML
   and PDF are shown inside the preview page's <iframe>, and the combined report's HTML inside
   the Report view's sandboxed preview frame, so those two routes may be framed by this origin
   only. While the dashboard hosts the terminal, pages may also connect to its helper on
   127.0.0.1 — on every page, because a client-side navigation to /terminal keeps the policy of
   the page it started on. */
import { COMBINED_ROUTE } from "../report/combined/options";
import { terminalEnabled, terminalSocketOrigin } from "../terminal/config";

export const EXPORT_ROUTE = /^\/api\/assessments\/[^/]+\/export$/;

/** Responses this origin may frame: the single export and the combined report. */
export const framable = (pathname: string) => EXPORT_ROUTE.test(pathname) || pathname === COMBINED_ROUTE;

export function contentSecurityPolicy(nonce: string, pathname: string): string {
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
    `frame-ancestors ${framable(pathname) ? "'self'" : "'none'"}`,
  ].join("; ");
}
