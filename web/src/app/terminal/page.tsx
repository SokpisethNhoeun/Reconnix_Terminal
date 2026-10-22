/* A short address for the Terminal view, which lives on the dashboard page (signed in, and only
   while this dashboard hosts the terminal: src/proxy.ts checks first, this page again). */
import { redirect } from "next/navigation";

import { requireTerminalAccess } from "@/lib/auth/guard";
import { TERMINAL_VIEW } from "@/lib/terminal/paths";

export default async function TerminalPage() {
  await requireTerminalAccess();
  redirect(TERMINAL_VIEW);
}
