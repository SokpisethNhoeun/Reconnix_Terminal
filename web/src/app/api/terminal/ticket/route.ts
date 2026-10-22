/* A single-use ticket for the Terminal page's socket: it needs a session, the terminal being
   on and the terminal key (lib/auth/session.ts), which sign-in sets only while it is on. With
   it comes the hello the real helper will send first. The helper (reconix/webterm) checks the
   ticket again, with the page's Origin and a loopback Host. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/auth/origin";
import { COOKIE, TERMINAL_COOKIE, launchToken, readSession, readTerminalKey } from "@/lib/auth/session";
import { issueTicket } from "@/lib/auth/ticket";
import { terminalEnabled, terminalSocketUrl } from "@/lib/terminal/config";
import { TERMINAL_OFF } from "@/lib/terminal/paths";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const token = launchToken();
  if (!token) return NextResponse.json({ detail: "The dashboard was not started with npm start." }, { status: 503 });

  if (!isSameOrigin(request)) {
    return NextResponse.json({ detail: "Open the terminal from the dashboard page." }, { status: 403 });
  }
  const jar = await cookies();
  if (!readSession(jar.get(COOKIE)?.value, token)) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
  if (!terminalEnabled()) return NextResponse.json({ detail: TERMINAL_OFF }, { status: 403 });
  if (!readTerminalKey(jar.get(TERMINAL_COOKIE)?.value, token)) {
    return NextResponse.json(
      { detail: "The terminal's key is missing or has expired. Sign in again with the dashboard's link." },
      { status: 403 },
    );
  }
  return NextResponse.json({ ...issueTicket(token), url: terminalSocketUrl() }, { headers: NO_STORE });
}
