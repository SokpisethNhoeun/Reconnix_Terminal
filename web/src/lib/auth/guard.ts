/* A second lock behind src/proxy.ts: the data loader itself requires the viewer role, and
   the Terminal page the operator role, so nothing renders even if a route ever slips past
   the proxy. */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { terminalEnabled } from "../terminal/config";
import { COOKIE, type Role, hasRole, launchToken, mayUseTerminal, readRole } from "./session";

/** The signed-in role, or null. Reads the cookies first, so every page that checks a role
    renders per request (never prerendered at build time, when there is no launch token). */
export async function currentRole(): Promise<Role | null> {
  const jar = await cookies();
  const token = launchToken();
  return token ? readRole(jar.get(COOKIE)?.value, token) : null;
}

export async function requireViewer(): Promise<void> {
  if (!hasRole(await currentRole(), "viewer")) redirect("/login");
}

/** What the Terminal view may show this browser. "operator": the terminal. "viewer": signed in,
    but without the operator role. "off": this dashboard was started without the terminal
    (`--no-terminal`). The page renders the terminal only for "operator". */
export type TerminalAccess = "operator" | "viewer" | "off";

export async function terminalAccess(): Promise<TerminalAccess> {
  if (!terminalEnabled()) return "off";
  return mayUseTerminal(await currentRole()) ? "operator" : "viewer";
}

/** The Terminal page: operators only, and only while this dashboard hosts the terminal. */
export async function requireTerminalAccess(): Promise<void> {
  const role = await currentRole();
  if (!hasRole(role, "viewer")) redirect("/login");
  if (!mayUseTerminal(role)) redirect("/");
}
