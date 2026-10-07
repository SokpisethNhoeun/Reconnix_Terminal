/* A single-use ticket for the Terminal page's socket, for operators only: it needs the
   operator session cookie and the terminal key (lib/auth/session.ts). With it comes the
   hello the real helper will send first. The helper (reconix/webterm) checks the ticket
   again, with the page's Origin and a loopback Host. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/auth/origin";
import { COOKIE, TERMINAL_COOKIE, launchToken, mayUseTerminal, readRole, readTerminalKey } from "@/lib/auth/session";
import { issueTicket } from "@/lib/auth/ticket";
import { terminalSocketUrl } from "@/lib/terminal/config";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const token = launchToken();
  if (!token) return NextResponse.json({ detail: "The dashboard was not started with npm start." }, { status: 503 });

  if (!isSameOrigin(request)) {
    return NextResponse.json({ detail: "Open the terminal from the dashboard page." }, { status: 403 });
  }
  const jar = await cookies();
  if (!mayUseTerminal(readRole(jar.get(COOKIE)?.value, token)) || !readTerminalKey(jar.get(TERMINAL_COOKIE)?.value, token)) {
    return NextResponse.json({ detail: "The terminal needs the operator role. Sign in again with the dashboard's link." }, { status: 403 });
  }
  return NextResponse.json({ ...issueTicket(token), url: terminalSocketUrl() }, { headers: NO_STORE });
}
