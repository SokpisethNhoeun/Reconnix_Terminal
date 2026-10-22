/* The model that answers the AI Assistant's next question (operators only; src/proxy.ts checks
   the role too). PUT { providerId, model }: a saved provider's listed model whose address may be
   used now, or { providerId: "environment", model } for the model from web/.env.local (the
   default: the saved choice is cleared). Needs the page's own Origin. Answers with the Model
   menu's whole view (never a key); the next question is asked with the new model. */
import { NextResponse } from "next/server";

import { fail, NO_STORE, refuse } from "@/lib/assistant/access";
import { SetActiveSchema } from "@/lib/assistant/models/requests";
import { modelsView } from "@/lib/assistant/models/resolve";
import { readBody, trouble } from "@/lib/assistant/models/respond";
import { ENVIRONMENT } from "@/lib/assistant/models/schema";
import { setActive } from "@/lib/assistant/models/store";

export async function PUT(request: Request) {
  const refused = await refuse(request, { change: true });
  if (refused) return refused;
  const body = await readBody(request, SetActiveSchema, "Send { providerId, model } only.");
  if (!body.ok) return body.response;
  const { providerId, model } = body.value;
  if (providerId === ENVIRONMENT && process.env.LLM_MODEL?.trim() !== model) {
    return fail("The Environment has no model of that name (LLM_MODEL in web/.env.local).", 400);
  }
  try {
    await setActive(providerId === ENVIRONMENT ? null : { providerId, model });
    return NextResponse.json(await modelsView(), { headers: NO_STORE });
  } catch (error) {
    return trouble(error);
  }
}
