/* The model list behind the model picker's Continue (operators only; src/proxy.ts checks the
   role too). POST { providerId } lists a saved provider's models as saved (the Environment too),
   POST { baseUrl, apiKey? } the picker's unsaved address; a saved key only ever goes to its saved address. The
   address is checked first, then GET {base}/models (no redirects, ten seconds, no cache, 1 MB
   at most). Answers { models }: the names a model name may be, sorted, at most 200; a model
   server that can't answer is a 502 with a fixed reason. Needs the page's own Origin. */
import { NextResponse } from "next/server";

import { fail, NO_STORE, refuse } from "@/lib/assistant/access";
import { createLimiter } from "@/lib/assistant/rate";
import { fetchModels } from "@/lib/assistant/models/remote";
import { ProbeSchema } from "@/lib/assistant/models/requests";
import { probeTarget } from "@/lib/assistant/models/resolve";
import { readBody, trouble } from "@/lib/assistant/models/respond";

const limiter = createLimiter(30, 2);

export async function POST(request: Request) {
  const refused = await refuse(request, { change: true });
  if (refused) return refused;
  const body = await readBody(request, ProbeSchema, "Send { providerId } or { baseUrl, apiKey? } only.");
  if (!body.ok) return body.response;
  let config;
  try {
    config = await probeTarget(body.value, false);
  } catch (error) {
    return trouble(error);
  }
  const release = limiter.take();
  if (!release) return fail("Too many requests at once. Wait a moment and try again.", 429);
  try {
    const listed = await fetchModels(config);
    return listed.ok ? NextResponse.json({ models: listed.models }, { headers: NO_STORE }) : fail(listed.detail, 502);
  } finally {
    release();
  }
}
