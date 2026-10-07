"use client";

/* The Reconix TUI in the browser: an xterm.js terminal on a socket to the terminal helper,
   with the session's status and its controls (copy, clear, restart, expand, ↓ Latest).
   Expand fills the browser window rather than the screen, so Esc still reaches the TUI. */
import "@xterm/xterm/css/xterm.css";

import { useRef, useState } from "react";

import { Card } from "../neu/card";
import { Dot, type Tone } from "../neu/chips";
import { ScrollToLatest } from "./scroll-to-latest";
import { TerminalToolbar } from "./terminal-toolbar";
import { useLeaveWarning } from "./use-leave-warning";
import { type SessionState, useTerminalSession } from "./use-terminal-session";
import { useTerminalView } from "./use-terminal-view";
import { useXterm } from "./use-xterm";

const STATUS: Record<SessionState, { tone: Tone; label: string }> = {
  connecting: { tone: "warn", label: "Connecting…" },
  connected: { tone: "ok", label: "Connected" },
  ended: { tone: "faint", label: "Ended" },
  failed: { tone: "bad", label: "Not connected" },
};

const COPY_FAILED = "The browser didn't allow copying. Hold Shift and drag over the text to select it, then copy it from the browser's menu.";

export function TerminalPanel({ hidden = false }: { hidden?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const terminal = useXterm(host);
  const { state, message, restart, redraw } = useTerminalSession(terminal);
  const view = useTerminalView(terminal);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  useLeaveWarning(state === "connected");
  if (hidden && expanded) setExpanded(false); // leaving the page restores it
  const status = STATUS[state];
  const focus = () => terminal?.focus();

  return (
    <Card
      title="Session"
      hint="this tab's own Reconix session"
      className={hidden ? "hidden" : expanded ? "term-full" : undefined}
      actions={
        <>
          <span className="pill" role="status" aria-live="polite">
            <Dot tone={status.tone} />
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
        </>
      }
    >
      <div className="term">
        <div ref={host} className="h-full w-full" aria-label="Reconix terminal" />
        <ScrollToLatest shown={!view.atBottom} onClick={view.scrollToLatest} />
      </div>
      {(message || notice) && <p className="text-[12.5px] text-muted">{message || notice}</p>}
    </Card>
  );
}
