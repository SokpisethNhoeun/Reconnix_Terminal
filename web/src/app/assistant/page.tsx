/* A short address for the AI Assistant, which lives on the dashboard page (`?view=assistant`).
   Any signed-in role may open it; asking the model needs the operator role (the route checks). */
import { redirect } from "next/navigation";

import { ASSISTANT_VIEW } from "@/lib/assistant/paths";
import { requireViewer } from "@/lib/auth/guard";

export default async function AssistantPage() {
  await requireViewer();
  redirect(ASSISTANT_VIEW);
}
