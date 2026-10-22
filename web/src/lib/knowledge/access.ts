/* The locks every Security knowledge route checks itself (src/proxy.ts checks the role too): the
   AI Assistant's (lib/assistant/access.ts: the launch token, a signed-in operator, and the page's
   own Origin for a change), with this page's own refusal for a viewer. Server only. */
import "server-only";

import { refuse } from "../assistant/access";
import { SOURCE_ID } from "../assistant/knowledge/schema";

export const KNOWLEDGE_OPERATOR_ONLY = "Security knowledge needs the operator role. Sign in with the link /web prints.";
export const BAD_ID = "That is not a knowledge file id.";
export const GONE = "That knowledge file is not saved any more.";

/** A refusal, or null when the request may go on. `change`: it adds or removes something. */
export const refuseKnowledge = (request: Request, change: boolean) => refuse(request, { change, operatorOnly: KNOWLEDGE_OPERATOR_ONLY });

/** A knowledge file's id: 32 lower-case hex digits. */
export const isKnowledgeId = (id: string) => SOURCE_ID.test(id);
