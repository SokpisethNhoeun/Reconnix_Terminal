/* The page's side of the AI Assistant's routes (browser only): ask a question and read the
   NDJSON answer frame by frame, and list, read, rename and delete saved conversations. Every
   answer is checked against the shared schemas before the page uses it. */
import { z } from "zod";

import { type Conversation, ConversationSchema, type ConversationSummary, ConversationSummarySchema } from "./history-schema";
import { conversationRoute, CONVERSATIONS_ROUTE, ASSISTANT_ROUTE } from "./paths";
import { createFrameReader, type Frame } from "./protocol";

export type Failure = { ok: false; status: number; detail: string };

const FALLBACK: Record<number, string> = {
  401: "Your session ended. Open the dashboard again with the sign-in link /web prints.",
  403: "The AI Assistant needs the operator role. Sign in with the link /web prints.",
  404: "That is not saved any more.",
  413: "That is too long to send.",
  429: "Too many questions at once. Wait a moment and ask again.",
  503: "The assistant is not available right now.",
};

async function failure(response: Response): Promise<Failure> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  const detail = typeof body?.detail === "string" && body.detail.length <= 400 ? body.detail : (FALLBACK[response.status] ?? `The assistant could not answer (HTTP ${response.status}).`);
  return { ok: false, status: response.status, detail };
}

const offline = (): Failure => ({ ok: false, status: 0, detail: "The dashboard could not be reached. Is it still running?" });

const json = { "Content-Type": "application/json" };

// --- asking --------------------------------------------------------------------------------

export interface AskBody {
  conversationId?: string;
  uid: string | null;
  question: string;
  retry?: boolean;
}

/** Asks and calls `onFrame` for each frame as it arrives. Resolves when the answer ends
    (`complete`: its "done" frame came); rejects when `signal` aborts it (Stop). */
export async function askQuestion(body: AskBody, signal: AbortSignal, onFrame: (frame: Frame) => void): Promise<{ ok: true; complete: boolean } | Failure> {
  const response = await fetch(ASSISTANT_ROUTE, { method: "POST", headers: json, body: JSON.stringify(body), signal });
  if (!response.ok || !response.body) return failure(response);
  let complete = false;
  const frames = createFrameReader((frame) => {
    if (frame.t === "done") complete = true;
    onFrame(frame);
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    frames.push(decoder.decode(value, { stream: true }));
  }
  frames.push(decoder.decode());
  frames.end();
  return { ok: true, complete };
}

// --- saved conversations -------------------------------------------------------------------

const ListSchema = z.object({ conversations: z.array(ConversationSummarySchema), retentionDays: z.number().min(0) });
const OneSchema = z.object({ conversation: ConversationSchema });

async function call<T>(url: string, init: RequestInit, schema: z.ZodType<T>): Promise<{ ok: true; value: T } | Failure> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    return offline();
  }
  if (!response.ok) return failure(response);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, status: 500, detail: "The dashboard sent an answer the page doesn't understand." };
}

export async function listConversations(signal?: AbortSignal): Promise<{ ok: true; conversations: ConversationSummary[] } | Failure> {
  const result = await call(CONVERSATIONS_ROUTE, { signal }, ListSchema);
  return result.ok ? { ok: true, conversations: result.value.conversations } : result;
}

export async function readConversation(id: string, signal?: AbortSignal): Promise<{ ok: true; conversation: Conversation } | Failure> {
  const result = await call(conversationRoute(id), { signal }, OneSchema);
  return result.ok ? { ok: true, conversation: result.value.conversation } : result;
}

export async function renameConversation(id: string, title: string): Promise<{ ok: true; title: string } | Failure> {
  const result = await call(conversationRoute(id), { method: "PATCH", headers: json, body: JSON.stringify({ title }) }, z.object({ title: z.string() }));
  return result.ok ? { ok: true, title: result.value.title } : result;
}

export async function deleteConversation(id: string): Promise<{ ok: true } | Failure> {
  const result = await call(conversationRoute(id), { method: "DELETE" }, z.object({ deleted: z.number() }));
  return result.ok ? { ok: true } : result;
}

export async function deleteAllConversations(): Promise<{ ok: true } | Failure> {
  const result = await call(CONVERSATIONS_ROUTE, { method: "DELETE" }, z.object({ deleted: z.number() }));
  return result.ok ? { ok: true } : result;
}
