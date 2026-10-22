/* The locks every AI Assistant route checks itself (src/proxy.ts checks the role too): the
   launch token, a signed-in operator, and for anything that changes something the page's own
   Origin. Server only. */
import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isSameOrigin } from "../auth/origin";
import { COOKIE, hasRole, launchToken, readRole } from "../auth/session";

export const NO_STORE = { "Cache-Control": "no-store" };

export const fail = (detail: string, status: number) => NextResponse.json({ detail }, { status, headers: NO_STORE });

export const OPERATOR_ONLY = "The AI Assistant needs the operator role. Sign in with the link /web prints.";

/** A refusal, or null when the request may go on. `change`: it writes or deletes something.
    `operatorOnly`: the refusal a signed-in viewer gets (the Security knowledge routes name their
    own page). */
export async function refuse(
  request: Request,
  { change, operatorOnly = OPERATOR_ONLY }: { change: boolean; operatorOnly?: string },
): Promise<NextResponse | null> {
  const token = launchToken();
  if (!token) return fail("The dashboard was not started with npm start.", 503);
  if (change && !isSameOrigin(request)) return fail("Ask from the dashboard page.", 403);
  const role = readRole((await cookies()).get(COOKIE)?.value, token);
  if (!hasRole(role, "operator")) return fail(operatorOnly, 403);
  return null;
}

/** The body's bytes, or null once they pass `max` (a missing Content-Length can't hide it: the
    stream is counted as it is read, and dropped at the first byte too many). */
export async function readBytes(request: Request, max: number): Promise<Buffer | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** The body as text, or null once it passes `max` bytes (readBytes). */
export async function readBody(request: Request, max: number): Promise<string | null> {
  const bytes = await readBytes(request, max);
  return bytes === null ? null : bytes.toString("utf8");
}

/** The body as JSON, or a refusal (too big: 413, not JSON: 400). */
export async function readJson(request: Request, max: number): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const text = await readBody(request, max);
  if (text === null) return { ok: false, response: fail("The request is too large.", 413) };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: fail("The request is not valid JSON.", 400) };
  }
}
