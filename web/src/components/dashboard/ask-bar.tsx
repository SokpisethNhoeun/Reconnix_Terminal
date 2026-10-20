"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LineChart, Maximize2, Mic, Send, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useAssistant } from "@/components/assistant/assistant-provider";
import type { OverviewCards } from "@/components/dashboard/derive";
import { TypedPlaceholder } from "@/components/dashboard/typed-placeholder";
import { openAssistant } from "@/components/dashboard/view-url";

// Ask bar (§5.7): the AI Assistant's entry on the Overview. A click anywhere on it opens the
// assistant (once: opening while it is open does nothing); its field edits the same draft as
// the assistant's composer, and Send asks the question and opens the assistant. The mic and the
// docs link keep their own behaviour (data-keep). The cycling typed placeholder lives in
// TypedPlaceholder (animation; reduced-motion shows the first question statically).
const KEEP = "[data-keep]";

export function AskBar({ data }: { data: OverviewCards["ask"] }) {
  const { draft, setDraft, ask } = useAssistant();
  const [micNote, setMicNote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim()) ask();
    openAssistant();
  };
  const openFrom = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest(KEEP)) openAssistant();
  };

  return (
    <div className="dash-card dash-glass dash-askbar flex cursor-pointer flex-col justify-center gap-1.5 py-2" onClick={openFrom}>
      <form onSubmit={submit} className="flex h-[44px] items-center gap-2.5 px-1">
        <Sparkles className="size-4 shrink-0 text-primary" strokeWidth={1.6} aria-hidden />
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={data.label}
            className="w-full bg-transparent text-sm text-foreground focus-visible:outline-none"
          />
          <TypedPlaceholder inputRef={inputRef} questions={data.questions} filled={draft.length > 0} />
        </div>
        <button
          type="button"
          data-keep
          aria-disabled="true"
          aria-label="Voice input (not available)"
          onClick={() => setMicNote((v) => !v)}
          className="grid size-[34px] shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mic className="size-[18px]" strokeWidth={1.6} aria-hidden />
        </button>
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Open the AI Assistant"
          title="Open the AI Assistant"
          className="hidden size-[34px] shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid"
        >
          <Maximize2 className="size-[16px]" strokeWidth={1.6} aria-hidden />
        </button>
        <button
          type="submit"
          aria-label="Send"
          className="grid size-[34px] shrink-0 place-items-center rounded-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: "var(--primary-strong)", color: "var(--primary-foreground)" }}
        >
          <Send className="size-[16px]" strokeWidth={1.8} aria-hidden />
        </button>
      </form>

      {micNote ? (
        <p data-keep className="dash-note px-1 text-[11px] text-muted-foreground" role="status">
          Voice input isn&apos;t available yet. Type your question, or open the AI Assistant.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-mono text-[10px] text-muted-foreground">
          <span className="dash-chip h-[26px]">
            <ShieldCheck className={data.scope.ok ? "size-3 text-success" : "size-3 text-accent"} aria-hidden />
            {data.scope.text}
          </span>
          <span className="dash-chip h-[26px]">
            <Target className="size-3 text-primary" aria-hidden /> {data.reach}
          </span>
          <Link
            href="/docs/guardrails/llm-data-handling"
            data-keep
            className="dash-chip ml-auto h-[26px] rounded-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LineChart className="size-3" aria-hidden /> AI analysis
          </Link>
        </div>
      )}
    </div>
  );
}
