/* Access to the local dashboard: a launch token, a signed session cookie and a role.

   `npm start` / `npm run dev` (scripts/serve.mjs) make a new random token each time and
   print a sign-in link that carries it. The sign-in route trades the token for a cookie
   holding "<role>.<issued-at>.<HMAC(token, role + issued-at)>"; the server checks both, so
   a cookie stops working after 12 hours or when the dashboard restarts with a new token
   (cookies are per host, not per port: don't run untrusted services on 127.0.0.1).

   Roles, weakest first: `viewer` reads every page (all pages and routes require it, in
   src/proxy.ts and again in the handlers); `operator` may also use the Terminal page. The
   sign-in link grants `operator` while the dashboard hosts the terminal (whoever holds the
   link owns this computer), else `viewer`.

   An operator also gets a second cookie, the terminal key: signed differently (so the
   session cookie can't be turned into it) and sent only to /api/terminal, so other servers
   on 127.0.0.1 — and the socket to the terminal helper — never see it. Minting a terminal
   ticket needs both. */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { terminalEnabled } from "../terminal/config";

export const COOKIE = "reconix_view";
export const TERMINAL_COOKIE = "reconix_term";
export const TERMINAL_COOKIE_PATH = "/api/terminal";
export const MAX_AGE_SECONDS = 12 * 60 * 60;
export const ROLES = ["viewer", "operator"] as const;
export type Role = (typeof ROLES)[number];

/** The token this server was started with, or null (then nothing is served). */
export function launchToken(): string | null {
  const token = process.env.RECONIX_WEB_TOKEN?.trim();
  return token && token.length >= 16 ? token : null;
}

export function port(): string {
  return process.env.RECONIX_WEB_PORT || process.env.PORT || "3100";
}

/** Host headers the dashboard answers to (anything else is refused: DNS rebinding). */
export function allowedHosts(): string[] {
  return [`127.0.0.1:${port()}`, `localhost:${port()}`];
}

const sign = (role: Role, issued: number, token: string) =>
  createHmac("sha256", token).update(`reconix-web:${role}:${issued}`).digest("base64url");

/** Constant-time equality (both sides are hashed first, so lengths never leak). */
function sameText(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export const tokenMatches = (given: string, token: string) => sameText(given, token);

/** The cookie value for `role`, issued at `now` (ms). */
export function sessionValue(role: Role, token: string, now: number = Date.now()): string {
  const issued = Math.floor(now / 1000);
  return `${role}.${issued}.${sign(role, issued, token)}`;
}

/** The role a cookie value grants, or null when it is missing, forged, expired or stale. */
export function readRole(value: string | undefined, token: string, now: number = Date.now()): Role | null {
  const [role, issuedText, signature, ...rest] = (value ?? "").split(".");
  if (rest.length || !signature || !ROLES.includes(role as Role) || !/^\d{1,12}$/.test(issuedText)) return null;
  const issued = Number(issuedText);
  const age = Math.floor(now / 1000) - issued;
  if (age < -60 || age > MAX_AGE_SECONDS) return null;
  return sameText(signature, sign(role as Role, issued, token)) ? (role as Role) : null;
}

/** Whether `role` may do what `needed` allows (roles are ordered weakest first). */
export function hasRole(role: Role | null, needed: Role): boolean {
  return role !== null && ROLES.indexOf(role) >= ROLES.indexOf(needed);
}

/** The role the sign-in link grants. */
export function signInRole(): Role {
  return terminalEnabled() ? "operator" : "viewer";
}

/** Whether `role` may use the Terminal page (only while this dashboard hosts it). */
export function mayUseTerminal(role: Role | null): boolean {
  return terminalEnabled() && hasRole(role, "operator");
}

const signKey = (issued: number, token: string) =>
  createHmac("sha256", token).update(`reconix-term-key:${issued}`).digest("base64url");

/** The terminal key cookie's value, issued at `now` (ms). */
export function terminalKeyValue(token: string, now: number = Date.now()): string {
  const issued = Math.floor(now / 1000);
  return `${issued}.${signKey(issued, token)}`;
}

/** Whether a terminal key is genuine and current (same lifetime as the session cookie). */
export function readTerminalKey(value: string | undefined, token: string, now: number = Date.now()): boolean {
  const [issuedText, signature, ...rest] = (value ?? "").split(".");
  if (rest.length || !signature || !/^\d{1,12}$/.test(issuedText)) return false;
  const issued = Number(issuedText);
  const age = Math.floor(now / 1000) - issued;
  if (age < -60 || age > MAX_AGE_SECONDS) return false;
  return sameText(signature, signKey(issued, token));
}
