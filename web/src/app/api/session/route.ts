/* Sign-in: trade the launch token for the viewer session cookie. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE, MAX_AGE_SECONDS, launchToken, sessionValue, tokenMatches } from "@/lib/auth/session";

const Body = z.object({ token: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const token = launchToken();
  if (!token) return NextResponse.json({ detail: "The dashboard was not started with npm start." }, { status: 503 });

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || origin !== `http://${host}`) {
    return NextResponse.json({ detail: "Sign in from the dashboard page." }, { status: 403 });
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !tokenMatches(body.data.token, token)) {
    return NextResponse.json({ detail: "This sign-in link is not valid any more." }, { status: 401 });
  }

  (await cookies()).set(COOKIE, sessionValue("viewer", token), {
    httpOnly: true,
    sameSite: "strict",
    secure: false, // served over http on 127.0.0.1 only
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return NextResponse.json({ role: "viewer" });
}
