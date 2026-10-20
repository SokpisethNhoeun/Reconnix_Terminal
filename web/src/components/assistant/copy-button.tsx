"use client";

/* Copy text to the clipboard, with "Copied" (or why not) for a moment after. The text is read
   when pressed, so a reply still streaming copies what is there then. */
import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label, className }: { text: string | (() => string); label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1_800);
  };

  const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;
  const shown = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy";
  return (
    <button type="button" onClick={copy} aria-label={state === "idle" ? label : shown} title={label} className={cn("ai-btn ai-btn-small", className)}>
      <Icon className="size-3.5" aria-hidden />
      <span aria-live="polite">{shown}</span>
    </button>
  );
}
