/* Runs before every page and route: refuses foreign Host headers, requires the viewer
   role (except for the sign-in page and route) and the operator role for the terminal, the
   AI Assistant's routes and the Security knowledge routes, and sets the strict Content-Security-Policy from lib/auth/csp.ts with a
   fresh script nonce (not on a knowledge file's original, which sets a stricter one). */
import { type NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy } from "@/lib/auth/csp";
import { COOKIE, allowedHosts, hasRole, launchToken, mayUseTerminal, readRole } from "@/lib/auth/session";
import { isAssistantPath } from "@/lib/assistant/paths";
import { isKnowledgeOriginalPath, isKnowledgePath } from "@/lib/knowledge/paths";
import { isTerminalPath } from "@/lib/terminal/paths";

const PUBLIC_PATHS = new Set(["/login", "/api/session"]);

export function proxy(request: NextRequest) {
  const token = launchToken();
  if (!token) {
    return new NextResponse("Start the dashboard with `npm start`; it creates the sign-in link.", { status: 503 });
  }
  if (!allowedHosts().includes(request.headers.get("host") ?? "")) {
    return new NextResponse("This dashboard only answers on 127.0.0.1.", { status: 403 });
  }

  const { pathname } = request.nextUrl;
  const role = readRole(request.cookies.get(COOKIE)?.value, token);
  if (!PUBLIC_PATHS.has(pathname) && !hasRole(role, "viewer")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ detail: "Sign in first." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isTerminalPath(pathname) && !mayUseTerminal(role)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ detail: "The terminal needs the operator role." }, { status: 403 });
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isAssistantPath(pathname) && !hasRole(role, "operator")) {
    return NextResponse.json({ detail: "The AI Assistant needs the operator role." }, { status: 403 });
  }
  if (isKnowledgePath(pathname) && !hasRole(role, "operator")) {
    return NextResponse.json({ detail: "Security knowledge needs the operator role." }, { status: 403 });
  }
  // a knowledge file's original carries its own policy (a sandbox with nothing allowed): the
  // page's policy set here would replace it
  if (isKnowledgeOriginalPath(pathname)) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
