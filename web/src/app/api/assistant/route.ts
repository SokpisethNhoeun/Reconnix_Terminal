/* The AI Assistant's question route (operators only; src/proxy.ts checks the role too). In
   order: the launch token, the page's origin, the operator role, a configured model, a rate
   slot (before any reading), the body (bytes counted as they arrive), its shape, the saved data
   (read here, never taken from the request). Questions are masked (lib/assistant/redact.ts)
   before they go anywhere, the reply streams back as plain text, and nothing is written or
   logged. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { modelSetup } from "@/lib/assistant/config";
import { buildContext } from "@/lib/assistant/context";
import { ModelError, streamReply } from "@/lib/assistant/llm";
import { systemPrompt } from "@/lib/assistant/prompt";
import { createLimiter } from "@/lib/assistant/rate";
import { redact } from "@/lib/assistant/redact";
import { ChatRequestSchema, MAX_BODY } from "@/lib/assistant/request";
import { isSameOrigin } from "@/lib/auth/origin";
import { COOKIE, hasRole, launchToken, readRole } from "@/lib/auth/session";
import { loadLibrary } from "@/lib/data/store";

const NO_STORE = { "Cache-Control": "no-store" };
const limiter = createLimiter();
const fail = (detail: string, status: number) => NextResponse.json({ detail }, { status, headers: NO_STORE });

/** The body as text, or null once it passes `max` bytes (a missing Content-Length can't hide it). */
async function readBody(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return "";
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
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  const token = launchToken();
  if (!token) return fail("The dashboard was not started with npm start.", 503);
  if (!isSameOrigin(request)) return fail("Ask from the dashboard page.", 403);
  const role = readRole((await cookies()).get(COOKIE)?.value, token);
  if (!hasRole(role, "operator")) return fail("The AI Assistant needs the operator role. Sign in with the link /web prints.", 403);

  const setup = modelSetup();
  if (!setup.ok) return fail(setup.reason, 503);

  const release = limiter.take();
  if (!release) return fail("Too many questions at once. Wait a moment and ask again.", 429);
  let streaming = false; // from here the reply stream hands the slot back
  try {
    const text = await readBody(request, MAX_BODY);
    if (text === null) return fail("The conversation is too long to send.", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail("The request is not valid JSON.", 400);
    }
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) return fail("The request does not match what the assistant accepts.", 400);

    const library = await loadLibrary();
    const context = buildContext(library.assessments, parsed.data.uid);
    if (!context) return fail("That assessment is not saved any more. Pick another one.", 404);

    const turns = parsed.data.messages.map((m) => ({ role: m.role, content: redact(m.content) }));
    try {
      const reply = await streamReply(setup.config, [{ role: "system", content: systemPrompt(context.scope, context.text) }, ...turns], request.signal, release);
      streaming = true;
      return new Response(reply, {
        headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
      });
    } catch (error) {
      if (error instanceof ModelError) return fail(error.message, error.status);
      return fail("The AI model could not be asked.", 502);
    }
  } finally {
    if (!streaming) release();
  }
}
