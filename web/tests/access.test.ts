/* No roles: the proxy and the terminal ticket route. Signed out (or with an old role-prefixed
   cookie), pages go to /login and routes answer 401; signed in, every page and route is passed
   on — the AI Assistant's, Security knowledge's and, while the dashboard hosts the terminal, the
   Terminal's. The ticket still needs the terminal key cookie too, and the terminal being on. */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COOKIE, sessionValue, TERMINAL_COOKIE, terminalKeyValue } from "@/lib/auth/session";
import { signTicket } from "@/lib/auth/ticket";
import { TERMINAL_OFF } from "@/lib/terminal/paths";

const TOKEN = "access-test-token-0123456789";
const ORIGIN = "http://127.0.0.1:3100";
const jar: Record<string, string> = {};
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar[name] ? { value: jar[name] } : undefined) }) }));

const { proxy } = await import("@/proxy");
const ticket = await import("@/app/api/terminal/ticket/route");

const KEYS = ["RECONIX_WEB_TOKEN", "RECONIX_WEB_TERMINAL", "RECONIX_TERM_PORT"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  process.env.RECONIX_WEB_TOKEN = TOKEN;
  process.env.RECONIX_WEB_TERMINAL = "1";
  process.env.RECONIX_TERM_PORT = "3101";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  for (const k of Object.keys(jar)) delete jar[k];
});

const through = (path: string, session: string | null, method = "GET") =>
  proxy(new NextRequest(`${ORIGIN}${path}`, { method, headers: { host: "127.0.0.1:3100", ...(session !== null ? { cookie: `${COOKIE}=${session}` } : {}) } }));

const PAGES = ["/", "/?view=assistant", "/?view=knowledge", "/?view=terminal", "/docs", "/assistant", "/terminal"];
const ROUTES: [string, string][] = [
  ["/api/assistant", "POST"],
  ["/api/assistant/conversations", "GET"],
  ["/api/assistant/models", "GET"],
  ["/api/knowledge", "GET"],
  ["/api/knowledge", "POST"],
  ["/api/terminal/ticket", "POST"],
  ["/api/reports/combined", "GET"],
];

describe("the proxy", () => {
  it.each(PAGES)("sends a signed-out visitor of %s to sign-in", async (path) => {
    const res = await through(path, null);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it.each(ROUTES)("answers 401 on %s %s without a session", async (path, method) => {
    const res = await through(path, null, method);
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toBe("Sign in first.");
  });

  it("no longer takes an old role-prefixed cookie: its owner signs in again", async () => {
    const old = `operator.${sessionValue(TOKEN)}`;
    expect((await through("/api/assistant/models", old)).status).toBe(401);
    expect(new URL((await through("/", old)).headers.get("location") ?? "").pathname).toBe("/login");
  });

  it.each([...PAGES.map((p): [string, string] => [p, "GET"]), ...ROUTES])("passes a session on to %s %s", async (path, method) => {
    const res = await through(path, sessionValue(TOKEN), method);
    expect(res.status).toBe(200); // NextResponse.next(): the page or handler answers
    expect(res.headers.get("location")).toBeNull();
  });

  it("keeps the Terminal's page and routes shut while the terminal is off", async () => {
    process.env.RECONIX_WEB_TERMINAL = "0";
    const page = await through("/terminal", sessionValue(TOKEN));
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location") ?? "").pathname).toBe("/");
    const route = await through("/api/terminal/ticket", sessionValue(TOKEN), "POST");
    expect(route.status).toBe(403);
    expect((await route.json()).detail).toBe(TERMINAL_OFF);
    expect((await through("/api/assistant/models", sessionValue(TOKEN))).status).toBe(200); // the rest stays open
    expect((await through("/api/knowledge", sessionValue(TOKEN))).status).toBe(200);
  });

  it("still answers only on 127.0.0.1", async () => {
    const res = await proxy(new NextRequest("http://evil.example/", { headers: { host: "evil.example", cookie: `${COOKIE}=${sessionValue(TOKEN)}` } }));
    expect(res.status).toBe(403);
  });
});

describe("the terminal ticket", () => {
  const ask = (origin: string | null = ORIGIN) =>
    ticket.POST(new Request(`${ORIGIN}/api/terminal/ticket`, { method: "POST", headers: { host: "127.0.0.1:3100", ...(origin ? { origin } : {}) } }));

  it("is handed to a session with the terminal key while the terminal is on", async () => {
    jar[COOKIE] = sessionValue(TOKEN);
    jar[TERMINAL_COOKIE] = terminalKeyValue(TOKEN);
    const res = await ask();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ticket: string; url: string };
    expect(body.url).toBe("ws://127.0.0.1:3101/");
    const [expires, nonce, signature] = body.ticket.split(".");
    expect(signature).toBe(signTicket(TOKEN, Number(expires), nonce));
  });

  it("needs the terminal key too: a session alone gets none", async () => {
    jar[COOKIE] = sessionValue(TOKEN);
    const res = await ask();
    expect(res.status).toBe(403);
    expect((await res.json()).detail).toMatch(/terminal's key/);
    jar[TERMINAL_COOKIE] = sessionValue(TOKEN); // the session cookie is no key
    expect((await ask()).status).toBe(403);
  });

  it("needs a session, the page's Origin and the terminal on", async () => {
    jar[TERMINAL_COOKIE] = terminalKeyValue(TOKEN);
    expect((await ask()).status).toBe(401);
    jar[COOKIE] = sessionValue(TOKEN);
    expect((await ask("http://evil.example")).status).toBe(403);
    expect((await ask(null)).status).toBe(403);
    process.env.RECONIX_WEB_TERMINAL = "0";
    const off = await ask();
    expect(off.status).toBe(403);
    expect((await off.json()).detail).toBe(TERMINAL_OFF);
  });
});
