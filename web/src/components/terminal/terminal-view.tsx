/* The viewer's Terminal view: the Reconix TUI while this dashboard hosts it, otherwise how to
   turn it on. The page decides `access` on the server (src/lib/auth/guard.ts), so the terminal
   is never rendered while it is off. The Viewer mounts this view on its first
   visit and then only hides it, so the session keeps running while you browse. */
import type { TerminalAccess } from "@/lib/auth/guard";

import { TerminalNotice } from "./terminal-notice";
import { TerminalPanel } from "./terminal-panel";

export function TerminalView({ access }: { access: TerminalAccess }) {
  return (
    <div className="dash-view">
      <header className="mb-4">
        <h1 className="text-[20px] font-medium text-foreground">Terminal</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          The Reconix TUI on this computer, with the same gates and approvals. What you run here shows up in the other views.
        </p>
      </header>
      {access === "on" ? <TerminalPanel /> : <TerminalNotice />}
    </div>
  );
}
