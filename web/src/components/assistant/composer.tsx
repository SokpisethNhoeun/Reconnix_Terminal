"use client";

/* The assistant's message box: the shared draft (the Overview's Ask bar edits the same one),
   Enter to send and Shift+Enter for a new line, Stop while a reply streams. No microphone: the
   app has no voice input. */
import { forwardRef } from "react";
import { Send, Square } from "lucide-react";
import { MAX_QUESTION } from "@/lib/assistant/request";
import { useAssistant } from "./assistant-provider";

export const Composer = forwardRef<HTMLTextAreaElement, { label: string }>(function Composer({ label }, ref) {
  const { draft, setDraft, ask, busy, stop, canAsk } = useAssistant();
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
