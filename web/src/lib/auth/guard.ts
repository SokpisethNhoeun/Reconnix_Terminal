/* A second lock behind src/proxy.ts: the data loader itself requires the viewer role, so
   no saved assessment renders even if a route ever slips past the proxy. */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE, hasRole, launchToken, readRole } from "./session";

export async function requireViewer(): Promise<void> {
  const token = launchToken();
  const role = token ? readRole((await cookies()).get(COOKIE)?.value, token) : null;
  if (!hasRole(role, "viewer")) redirect("/login");
}
