/* Sign-in: trade the launch token for the session cookie (operator while the dashboard
   hosts the terminal, else viewer: see lib/auth/session.ts). */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOrigin } from "@/lib/auth/origin";
import {
  COOKIE,
  MAX_AGE_SECONDS,
  TERMINAL_COOKIE,
  TERMINAL_COOKIE_PATH,
  launchToken,
  sessionValue,
  signInRole,
  terminalKeyValue,
  tokenMatches,
} from "@/lib/auth/session";

const Body = z.object({ token: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const token = launchToken();
  if (!token) return NextResponse.json({ detail: "The dashboard was not started with npm start." }, { status: 503 });

  if (!isSameOrigin(request)) {
    return NextResponse.json({ detail: "Sign in from the dashboard page." }, { status: 403 });
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !tokenMatches(body.data.token, token)) {
    return NextResponse.json({ detail: "This sign-in link is not valid any more." }, { status: 401 });
  }

  const role = signInRole();
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: "strict", secure: false /* http on 127.0.0.1 only */ } as const;
  jar.set(COOKIE, sessionValue(role, token), { ...options, path: "/", maxAge: MAX_AGE_SECONDS });
  jar.set(TERMINAL_COOKIE, role === "operator" ? terminalKeyValue(token) : "", {
    ...options,
    path: TERMINAL_COOKIE_PATH,
    maxAge: role === "operator" ? MAX_AGE_SECONDS : 0,
  });
  return NextResponse.json({ role });
}
