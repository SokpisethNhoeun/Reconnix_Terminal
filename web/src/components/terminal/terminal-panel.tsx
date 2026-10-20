"use client";

/* The Reconix TUI in the browser: an xterm.js terminal on a socket to the terminal helper,
   with the session's status and its controls (copy, clear, restart, expand, ↓ Latest).
   Expand fills the browser window rather than the screen, so Esc still reaches the TUI.
   Adapted from reconix-tui/web/src/components/terminal/terminal-panel.tsx; the session and
   socket code (use-terminal-session.ts) is the same as there. */
import "@xterm/xterm/css/xterm.css";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { parseView } from "@/components/dashboard/view-url";
import { cn } from "@/lib/utils";

import { ScrollToLatest } from "./scroll-to-latest";
import { TerminalToolbar } from "./terminal-toolbar";
import { useLeaveWarning } from "./use-leave-warning";
import { type SessionState, useTerminalSession } from "./use-terminal-session";
import { useTerminalView } from "./use-terminal-view";
import { useXterm } from "./use-xterm";

const STATUS: Record<SessionState, { color: string; label: string }> = {
  connecting: { color: "var(--accent)", label: "Connecting…" },
  connected: { color: "var(--success)", label: "Connected" },
  ended: { color: "var(--muted-foreground)", label: "Ended" },
  failed: { color: "var(--danger)", label: "Not connected" },
};

const COPY_FAILED = "The browser didn't allow copying. Hold Shift and drag over the text to select it, then copy it from the browser's menu.";

export function TerminalPanel() {
  const host = useRef<HTMLDivElement>(null);
  const terminal = useXterm(host);
  const { state, message, restart, redraw } = useTerminalSession(terminal);
  const view = useTerminalView(terminal);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const shown = parseView(useSearchParams().get("view")) === "terminal";
  useLeaveWarning(state === "connected");
  if (!shown && expanded) setExpanded(false); // leaving the view restores it
  const status = STATUS[state];
  const focus = () => terminal?.focus();

  return (
    <section aria-label="Terminal session" className={cn("dash-card flex flex-col gap-3", expanded && "term-full")}>
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-[13px] font-medium text-foreground">Session</h2>
        <span className="text-xs text-muted-foreground">this tab&apos;s own Reconix session</span>
        <span className="dash-chip ml-auto h-[26px] border border-border px-2.5 text-[11px] text-foreground" role="status" aria-live="polite">
          <span className="inline-block size-1.5 rounded-full" style={{ background: status.color }} aria-hidden />
          {status.label}
        </span>
        <TerminalToolbar
          state={state}
          expanded={expanded}
          onExpand={() => {
            setExpanded(!expanded);
            focus();
          }}
          onCopy={async () => {
            const ok = await view.copy();
            setNotice(ok ? "" : COPY_FAILED);
            return ok;
          }}
          onClear={() => {
            view.clear();
            if (state === "connected") redraw(); // the TUI paints its screen again
            focus();
          }}
          onRestart={() => {
            setNotice("");
            restart();
          }}
          onDone={focus}
        />
      </header>
      <div className="term">
        <div ref={host} className="h-full w-full" aria-label="Reconix terminal" />
        <ScrollToLatest shown={!view.atBottom} onClick={view.scrollToLatest} />
      </div>
      {(message || notice) && <p className="text-xs text-muted-foreground">{message || notice}</p>}
    </section>
  );
}
