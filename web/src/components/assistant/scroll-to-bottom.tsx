"use client";

/* "↓ New messages": shown over the bottom of a conversation while the reader has scrolled up
   (useStickToBottom's atBottom is false). The parent positions it. */
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollToBottom({ show, onClick, className }: { show: boolean; onClick: () => void; className?: string }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs text-foreground shadow-lg transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <ArrowDown className="size-3.5" aria-hidden /> New messages
    </button>
  );
}
