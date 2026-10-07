"use client";

/* The session's controls, kept small: copy, clear, restart, expand. Icon buttons on one
   well, each with a tooltip and a name for screen readers. Copy says how it went. */
import { Check, Copy, Eraser, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
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

  const copyLabel = copied === "ok" ? "Copied" : "Copy output";
  const expandLabel = expanded ? "Restore" : "Expand";
  return (
    <div role="toolbar" aria-label="Terminal controls" className="flex items-center gap-0.5 rounded-[10px] bg-well p-0.5 shadow-[var(--press-sm)]">
      <Button variant="quiet" size="icon-sm" aria-label={copyLabel} title={copyLabel} onClick={async () => setCopied((await onCopy()) ? "ok" : "failed")}>
        {copied === "ok" ? <Check aria-hidden className="text-ok" /> : <Copy aria-hidden />}
      </Button>
      <Button variant="quiet" size="icon-sm" aria-label="Clear terminal" title="Clear terminal" onClick={onClear}>
        <Eraser aria-hidden />
      </Button>
      <RestartButton live={state === "connected"} disabled={state === "connecting"} onRestart={onRestart} onClose={onDone} />
      <Button variant="quiet" size="icon-sm" aria-label={expandLabel} title={expandLabel} onClick={onExpand}>
        {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      </Button>
      <span className="sr-only-x" role="status">
        {copied === "ok" ? "Copied to the clipboard" : copied === "failed" ? "Couldn't copy" : ""}
      </span>
    </div>
  );
}
