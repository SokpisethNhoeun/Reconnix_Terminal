/* A short address for the Terminal view, which lives on the dashboard page (operators only:
   src/proxy.ts checks the role first, this page checks it again). */
import { redirect } from "next/navigation";

import { requireTerminalAccess } from "@/lib/auth/guard";
import { TERMINAL_VIEW } from "@/lib/terminal/paths";

export default async function TerminalPage() {
  await requireTerminalAccess();
  redirect(TERMINAL_VIEW);
}
