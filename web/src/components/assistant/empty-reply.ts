/* A reply that ended with nothing: no text, no card. The server marks it as an error ("The
   model sent an empty answer.", lib/assistant/reply.ts) and the page shows it as its own state,
   with Retry, instead of a failure: the model answered, it just said nothing. A reply that failed
   for another reason (the model unreachable, HTTP 500, the connection) keeps its detail. */
import type { ChatMessage } from "./types";

/** How the server words an answer that held nothing (reply.ts). */
export const EMPTY_ANSWER = /\bempty answer\b/i;

export const EMPTY_REPLY = {
  title: "The model returned nothing",
  body: "The model answered, but with no text and no card. Try asking again, or put the question another way.",
} as const;

export function isEmptyReply(m: Pick<ChatMessage, "role" | "state" | "content" | "cards" | "detail">): boolean {
  if (m.role !== "assistant" || m.state !== "error") return false;
  if (m.content.trim() !== "" || (m.cards?.length ?? 0) > 0) return false;
  return m.detail === undefined || EMPTY_ANSWER.test(m.detail);
}
