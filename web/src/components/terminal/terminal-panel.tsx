"use client";

/* The Reconix TUI in the browser: an xterm.js terminal on a socket to the terminal helper,
   with the session's status and a "New session" button. */
import "@xterm/xterm/css/xterm.css";

import { RotateCcw } from "lucide-react";
import { useRef } from "react";

import { Card } from "../neu/card";
import { Dot, type Tone } from "../neu/chips";
import { Button } from "../ui/button";
import { useLeaveWarning } from "./use-leave-warning";
import { type SessionState, useTerminalSession } from "./use-terminal-session";
import { useXterm } from "./use-xterm";

const STATUS: Record<SessionState, { tone: Tone; label: string }> = {
  connecting: { tone: "warn", label: "Connecting…" },
  connected: { tone: "ok", label: "Connected" },
  ended: { tone: "faint", label: "Ended" },
  failed: { tone: "bad", label: "Not connected" },
};

export function TerminalPanel({ hidden = false }: { hidden?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const terminal = useXterm(host);
  const { state, message, restart } = useTerminalSession(terminal);
  useLeaveWarning(state === "connected");
  const status = STATUS[state];

  return (
    <Card
      title="Session"
      hint="this tab's own Reconix session"
      className={hidden ? "hidden" : undefined}
      actions={
        <>
          <span className="pill" role="status" aria-live="polite">
            <Dot tone={status.tone} />
            {status.label}
          </span>
          <Button size="sm" onClick={restart} disabled={state === "connecting"}>
            <RotateCcw aria-hidden />
            New session
          </Button>
        </>
      }
    >
      <div className="term">
        <div ref={host} className="h-full w-full" aria-label="Reconix terminal" />
      </div>
      {message && <p className="text-[12.5px] text-muted">{message}</p>}
    </Card>
  );
}
