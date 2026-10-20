/* The AI Assistant's question route (operators only; src/proxy.ts checks the role too). In
   order: the launch token, the page's origin, the operator role, a configured model, a rate
   slot (before any reading), the body (bytes counted as they arrive), its shape, the
   conversation (read from the server's own file: the browser never sends the history) and the
   saved data (read here, never taken from the request). A conversation keeps the run it was
   started about. The question is masked, then cut, by the store before it is saved or sent
   anywhere; the answer streams back as NDJSON frames (lib/assistant/protocol.ts): the cards the
   server built from the saved files, then the model's text. The conversation's id also goes in
   the X-Conversation-Id header, so a page that stops before the first frame still knows it.
   Nothing is logged, and errors never name a path. */
import { modelSetup } from "@/lib/assistant/config";
import { buildContext } from "@/lib/assistant/context";
import { cardNotes, pickCards } from "@/lib/assistant/cards";
import { fail, NO_STORE, readJson, refuse } from "@/lib/assistant/access";
import type { Conversation } from "@/lib/assistant/history-schema";
import { addQuestion, HistoryError, readConversation } from "@/lib/assistant/history-store";
import { scopeOf } from "@/lib/assistant/insights";
import { readIntent } from "@/lib/assistant/intent";
import { fenceTag, systemPrompt } from "@/lib/assistant/prompt";
import { NDJSON } from "@/lib/assistant/protocol";
import { createLimiter, limitsFromEnv } from "@/lib/assistant/rate";
import { replyStream } from "@/lib/assistant/reply";
import { ChatRequestSchema, MAX_BODY } from "@/lib/assistant/request";
import { earlierTurns } from "@/lib/assistant/turns";
import { assessmentView } from "@/lib/data/adapt";
import { type Library, loadLibrary } from "@/lib/data/store";

const limiter = createLimiter(...limitsFromEnv());
const GONE = "That conversation is not saved any more. Start a new chat.";
const trouble = (error: unknown, otherwise: string) => fail(error instanceof HistoryError ? error.message : otherwise, 500);

export async function POST(request: Request) {
  const refused = await refuse(request, { change: true });
  if (refused) return refused;

  const setup = modelSetup();
  if (!setup.ok) return fail(setup.reason, 503);

  const release = limiter.take();
  if (!release) return fail("Too many questions at once. Wait a moment and ask again.", 429);
  let streaming = false; // from here the reply stream hands the slot back
  try {
    const body = await readJson(request, MAX_BODY);
    if (!body.ok) return body.response;
    const parsed = ChatRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail("The request does not match what the assistant accepts.", 400);
    const { conversationId, question, retry } = parsed.data;

    let existing: Conversation | null = null;
    let library: Library;
    try {
      if (conversationId) existing = await readConversation(conversationId);
      library = await loadLibrary();
    } catch (error) {
      return trouble(error, "The saved data could not be read.");
    }
    if (conversationId && !existing) return fail(GONE, 404);
    const uid = existing ? existing.scope.uid : parsed.data.uid; // a conversation keeps its run

    const context = buildContext(library.assessments, uid);
    if (!context) return fail("That assessment is not saved any more. Pick another one.", 404);
    const run = uid ? library.assessments.find((a) => a.uid === uid) : undefined;

    let saved;
    try {
      saved = await addQuestion({ id: existing?.id, scope: existing?.scope ?? scopeOf(run ? assessmentView(run) : null), question, retry });
    } catch (error) {
      return trouble(error, "The conversation could not be saved.");
    }
    if (saved === "busy") return fail("That question is still being answered. Wait for it, or stop it first.", 409);
    if (!saved) return fail(GONE, 404);
    const { conversation, asked } = saved;

    const cards = pickCards(library.assessments, uid, asked.content);
    const notes = { cards: cardNotes(cards), planning: readIntent(asked.content).intents.includes("plan") };
    const turns = [
      { role: "system" as const, content: systemPrompt(context.scope, context.text, fenceTag(), notes) },
      ...earlierTurns(conversation.messages, asked.id),
      { role: "user" as const, content: asked.content },
    ];
    const stream = replyStream({ config: setup.config, turns, conversation, asked, cards, signal: request.signal, release });
    streaming = true;
    return new Response(stream, {
      headers: { ...NO_STORE, "Content-Type": NDJSON, "X-Content-Type-Options": "nosniff", "X-Conversation-Id": conversation.id },
    });
  } finally {
    if (!streaming) release();
  }
}
