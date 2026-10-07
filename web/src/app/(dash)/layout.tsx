/* Every signed-in page: the sidebar and the working area. For operators it also holds the
   terminal session (TerminalDock), so the TUI keeps running from page to page. */
import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { TerminalDock } from "@/components/terminal/terminal-dock";
import { currentRole } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";
import { loadLibrary, shownDir } from "@/lib/data/store";

export default async function DashLayout({ children }: { children: ReactNode }) {
  const [{ dir, assessments }, role] = await Promise.all([loadLibrary(), currentRole()]);
  const findings = assessments.reduce((n, a) => n + a.findings.length, 0);
  const terminal = mayUseTerminal(role);
  return (
    <div className="shell">
      <Sidebar dir={shownDir(dir)} counts={{ assessments: assessments.length, findings }} terminal={terminal} />
      <main className="flex min-w-0 flex-col gap-6">
        {children}
        {terminal && <TerminalDock />}
      </main>
    </div>
  );
}
