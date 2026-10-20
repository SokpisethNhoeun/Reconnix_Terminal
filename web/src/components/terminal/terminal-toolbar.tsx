"use client";

/* The session's controls, kept small: copy, clear, restart, expand. Icon buttons in one
   group, each with a tooltip and a name for screen readers. Copy says how it went.
   (Adapted from reconix-tui/web/src/components/terminal/terminal-toolbar.tsx.) */
import { Check, Copy, Eraser, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/ui/icon-button";

import { RestartButton } from "./restart-button";
import type { SessionState } from "./use-terminal-session";

interface Props {
  state: SessionState;
  expanded: boolean;
  onExpand: () => void;
  onCopy: () => Promise<boolean>;
  onClear: () => void;
  onRestart: () => void;
  onDone: () => void; // put the keyboard back in the terminal
}

type Copied = "" | "ok" | "failed";

export function TerminalToolbar({ state, expanded, onExpand, onCopy, onClear, onRestart, onDone }: Props) {
  const [copied, setCopied] = useState<Copied>("");
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div role="toolbar" aria-label="Terminal controls" className="flex items-center gap-0.5 rounded-[10px] border border-border bg-card-2 p-0.5">
      <IconButton label={copied === "ok" ? "Copied" : "Copy output"} onClick={async () => setCopied((await onCopy()) ? "ok" : "failed")}>
        {copied === "ok" ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
      </IconButton>
      <IconButton label="Clear terminal" onClick={onClear}>
        <Eraser aria-hidden />
      </IconButton>
      <RestartButton live={state === "connected"} disabled={state === "connecting"} onRestart={onRestart} onDone={onDone} />
      <IconButton label={expanded ? "Restore" : "Expand"} onClick={onExpand}>
        {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      </IconButton>
      <span className="sr-only" role="status">
        {copied === "ok" ? "Copied to the clipboard" : copied === "failed" ? "Couldn't copy" : ""}
      </span>
    </div>
  );
}
