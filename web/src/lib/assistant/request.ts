/* What the browser may send to /api/assistant, checked on the server: the run in scope (a
   saved assessment's uid, or null for every run) and the conversation so far, ending with the
   operator's new question. The browser never sends assessment data: the server reads it. */
import { z } from "zod";

export const MAX_MESSAGES = 30;
export const MAX_QUESTION = 4_000; // characters in one operator message
export const MAX_REPLY = 8_000; // characters of an earlier reply sent back as history
export const MAX_BODY = 200_000; // bytes

const UID = /^\d{8}-\d{6}-[0-9a-f]{4}_[A-Za-z0-9-]{1,64}$/; // as lib/data/store.ts

const Message = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(MAX_QUESTION) }).strict(),
  z.object({ role: z.literal("assistant"), content: z.string().trim().min(1).max(MAX_REPLY) }).strict(),
]);

export const ChatRequestSchema = z
  .object({
    uid: z.string().regex(UID).nullable(),
    messages: z.array(Message).min(1).max(MAX_MESSAGES),
  })
  .strict()
  // (zod runs this even when `messages` already failed, so it must cope with an empty list)
  .refine((r) => r.messages.at(-1)?.role === "user", { message: "The last message must be the operator's question." });

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatTurn = ChatRequest["messages"][number];
