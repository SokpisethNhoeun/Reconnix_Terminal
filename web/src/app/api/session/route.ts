/* Sign-in: trade the launch token for the session cookie, and, while the dashboard hosts the
   terminal, the terminal key (see lib/auth/session.ts). There are no roles. */
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
  terminalKeyValue,
  tokenMatches,
} from "@/lib/auth/session";
import { terminalEnabled } from "@/lib/terminal/config";

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

  const terminal = terminalEnabled();
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: "strict", secure: false /* http on 127.0.0.1 only */ } as const;
  jar.set(COOKIE, sessionValue(token), { ...options, path: "/", maxAge: MAX_AGE_SECONDS });
  jar.set(TERMINAL_COOKIE, terminal ? terminalKeyValue(token) : "", {
    ...options,
    path: TERMINAL_COOKIE_PATH,
    maxAge: terminal ? MAX_AGE_SECONDS : 0,
  });
  return NextResponse.json({ signedIn: true, terminal });
}
