"use client";

/* The assistant's message box: the shared draft (the Overview's Ask bar edits the same one),
   Enter to send and Shift+Enter for a new line, Stop while a reply streams. The microphone is
   shown as on the Ask bar but voice input isn't available, so it only says so. */
import { forwardRef, useState } from "react";
import { Mic, Send, Square } from "lucide-react";
import { MAX_QUESTION } from "@/lib/assistant/request";
import { useAssistant } from "./assistant-provider";

export const Composer = forwardRef<HTMLTextAreaElement, { label: string }>(function Composer({ label }, ref) {
  const { draft, setDraft, ask, busy, stop, canAsk } = useAssistant();
  const [micNote, setMicNote] = useState(false);
  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!busy) ask();
  };
  return (
    <form onSubmit={send} className="dash-composer flex items-end gap-2 p-2">
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        maxLength={MAX_QUESTION}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
        }}
        aria-label={label}
        placeholder={canAsk ? "Ask about the findings, the scope, what waits on you…" : "Write your question (asking needs the setup below)"}
        className="max-h-[132px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none [field-sizing:content]"
      />
      <div className="relative">
        <button
          type="button"
          aria-disabled="true"
          aria-label="Voice input (not available)"
          onClick={() => setMicNote((v) => !v)}
          onBlur={() => setMicNote(false)}
          className="grid size-[38px] place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mic className="size-[18px]" strokeWidth={1.6} aria-hidden />
        </button>
        {micNote && (
          <span role="status" className="dash-pop absolute bottom-[calc(100%+6px)] right-0 w-max max-w-[220px] px-2.5 py-1.5 text-[11px] text-muted-foreground">
            Voice input isn&apos;t available yet. Type your question.
          </span>
        )}
      </div>
      {busy ? (
        <button
          type="button"
          onClick={stop}
          aria-label="Stop the answer"
          className="grid size-[38px] shrink-0 place-items-center rounded-lg border border-border text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Square className="size-3.5 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!canAsk || !draft.trim()}
          className="grid size-[38px] shrink-0 place-items-center rounded-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--primary-strong)", color: "var(--primary-foreground)" }}
        >
          <Send className="size-[16px]" strokeWidth={1.8} aria-hidden />
        </button>
      )}
    </form>
  );
});
