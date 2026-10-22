/* A second lock behind src/proxy.ts: the data loader itself requires a session, and the
   Terminal page a session and the terminal being on, so nothing renders even if a route ever
   slips past the proxy. */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { terminalEnabled } from "../terminal/config";
import { COOKIE, launchToken, readSession } from "./session";

/** Whether this browser is signed in. Reads the cookies first, so every page that checks it
    renders per request (never prerendered at build time, when there is no launch token). */
export async function signedIn(): Promise<boolean> {
  const jar = await cookies();
  const token = launchToken();
  return token ? readSession(jar.get(COOKIE)?.value, token) : false;
}

export async function requireSignedIn(): Promise<void> {
  if (!(await signedIn())) redirect("/login");
}

/** What the Terminal view may show. "on": the terminal. "off": this dashboard was started
    without the terminal (`--no-terminal`). */
export type TerminalAccess = "on" | "off";

export function terminalAccess(): TerminalAccess {
  return terminalEnabled() ? "on" : "off";
}

/** The Terminal page: signed in, and only while this dashboard hosts the terminal. */
export async function requireTerminalAccess(): Promise<void> {
  await requireSignedIn();
  if (!terminalEnabled()) redirect("/");
}
