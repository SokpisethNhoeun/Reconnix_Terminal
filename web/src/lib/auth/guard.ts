/* A second lock behind src/proxy.ts: the data loader itself requires the viewer role, and
   the Terminal page the operator role, so nothing renders even if a route ever slips past
   the proxy. */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE, type Role, hasRole, launchToken, mayUseTerminal, readRole } from "./session";

/** The signed-in role, or null. */
export async function currentRole(): Promise<Role | null> {
  const token = launchToken();
  return token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
}

export async function requireViewer(): Promise<void> {
  if (!hasRole(await currentRole(), "viewer")) redirect("/login");
}

/** The Terminal page: operators only, and only while this dashboard hosts the terminal. */
export async function requireTerminalAccess(): Promise<void> {
  const role = await currentRole();
  if (!hasRole(role, "viewer")) redirect("/login");
  if (!mayUseTerminal(role)) redirect("/");
}
