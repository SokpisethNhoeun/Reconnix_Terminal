/* A saved conversation, as the dashboard's server keeps it (lib/assistant/history-store.ts):
   its id, title, the run it is about, when it was started and last used, and its messages:
   each question (masked) and each reply with the cards that were shown with it and the names of
   the /add-on files it used. The browser
   reads the same shapes back from the conversation routes. Pure: browser and server. */
import { z } from "zod";

import { redact } from "./redact";
import { CardSchema, CONVERSATION_ID, KnowledgeNamesSchema, MAX_CARDS, ScopeRefSchema } from "./protocol";
import { MAX_QUESTION } from "./request";

export const CONVERSATION_FORMAT = "reconix.assistant.conversation/v1";
export const MAX_TITLE = 80; // a title the operator gives
export const AUTO_TITLE = 60; // a title taken from the first question
export const MAX_SAVED_REPLY = 16_000; // characters of a reply kept
export const MAX_CONVERSATIONS = 100; // the oldest go first
export const MAX_CONVERSATION_MESSAGES = 200; // the oldest go first
export const RETENTION_DAYS = 30; // without use (RECONIX_ASSISTANT_RETENTION_DAYS; 0 keeps them)
export const MAX_FILE_BYTES = 1_000_000;

const Id = z.string().regex(CONVERSATION_ID);
const Time = z.number().int().min(0).max(8.64e15);

export const UserMessageSchema = z.object({ id: Id, role: z.literal("user"), content: z.string().min(1).max(MAX_QUESTION), at: Time }).strict();

export const ReplyStateSchema = z.enum(["done", "stopped", "error"]);
export type ReplyState = z.infer<typeof ReplyStateSchema>;

export const ReplyMessageSchema = z
  .object({
    id: Id,
    role: z.literal("assistant"),
    replyTo: Id, // the question it answers
    content: z.string().max(MAX_SAVED_REPLY),
    cards: z.array(CardSchema).max(MAX_CARDS),
    state: ReplyStateSchema,
    detail: z.string().max(400).optional(), // what went wrong (state "error")
    // the /add-on files whose passages went to the model (came later: older replies have none)
    knowledge: KnowledgeNamesSchema.optional(),
    at: Time,
  })
  .strict();

export const StoredMessageSchema = z.discriminatedUnion("role", [UserMessageSchema, ReplyMessageSchema]);
export type StoredMessage = z.infer<typeof StoredMessageSchema>;
export type UserMessage = z.infer<typeof UserMessageSchema>;
export type ReplyMessage = z.infer<typeof ReplyMessageSchema>;

export const ConversationSchema = z
  .object({
    format: z.literal(CONVERSATION_FORMAT),
    id: Id,
    title: z.string().min(1).max(MAX_TITLE),
    scope: ScopeRefSchema,
    createdAt: Time,
    updatedAt: Time,
    messages: z.array(StoredMessageSchema).max(MAX_CONVERSATION_MESSAGES),
  })
  .strict();
export type Conversation = z.infer<typeof ConversationSchema>;

/** One row of the History menu. */
export const ConversationSummarySchema = z
  .object({ id: Id, title: z.string().max(MAX_TITLE), scope: ScopeRefSchema, createdAt: Time, updatedAt: Time, count: z.number().int().min(0) })
  .strict();
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const summaryOf = (c: Conversation): ConversationSummary => ({
  id: c.id,
  title: c.title,
  scope: c.scope,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  count: c.messages.length,
});

/** A title: masked (a pasted token never becomes a title), one line without control or
    invisible characters, cut to `max`. Empty when nothing is left. */
export function cleanTitle(text: string, max: number = MAX_TITLE): string {
  const flat = redact(text)
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
