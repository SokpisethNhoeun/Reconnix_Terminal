"use client";

/* The assistant's message box: the shared draft (the Overview's Ask bar edits the same one),
   growing with its text up to 8 lines. Enter sends, Shift+Enter starts a new line, Esc stops a
   reply being written. A counter shows near the 4,000-character limit. When asking isn't
   possible here, the box is disabled and the reason is shown above it. No microphone: the app
   has no voice input. */
import { forwardRef, useImperativeHandle, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { MAX_QUESTION } from "@/lib/assistant/request";
import { useAssistant } from "./assistant-provider";
import { useAutoResize } from "./use-auto-resize";

const COUNT_FROM = MAX_QUESTION - 500;

export const Composer = forwardRef<HTMLTextAreaElement, { label: string; disabledReason: string | null }>(function Composer({ label, disabledReason }, ref) {
  const { draft, setDraft, ask, busy, stop, opening } = useAssistant();
  const field = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => field.current as HTMLTextAreaElement, []);
  useAutoResize(field, draft);

  const disabled = disabledReason !== null;
  const empty = !draft.trim();
  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!busy && !disabled && !empty) ask();
  };
  const length = draft.length;
  const tone = length >= MAX_QUESTION ? "danger" : length >= MAX_QUESTION - 100 ? "warning" : undefined;

  return (
    <form onSubmit={send} className="ai-composer" data-disabled={disabled ? "" : undefined}>
      <textarea
        ref={field}
        rows={1}
        value={draft}
        maxLength={MAX_QUESTION}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
          else if (e.key === "Escape" && busy) {
            e.preventDefault();
            stop();
          }
        }}
        aria-label={label}
        aria-describedby={disabled ? "ai-composer-reason" : undefined}
        placeholder={disabled ? "Asking isn't available here (see above)" : "Ask anything about your assessments…"}
      />
      <div className="ai-composer-bar">
        {!disabled && <span className="ai-composer-hint hidden sm:inline">{busy ? "Esc to stop" : "Enter to send · Shift+Enter for a new line"}</span>}
        {length >= COUNT_FROM && (
          <span className="ai-counter" data-tone={tone} aria-live="polite">
            {length.toLocaleString("en-US")} / {MAX_QUESTION.toLocaleString("en-US")}
          </span>
        )}
        {busy ? (
          <button type="button" onClick={stop} aria-label="Stop the answer" title="Stop (Esc)" className="ai-send" data-stop="">
            <Square className="size-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            title={disabled ? (disabledReason ?? undefined) : opening ? "Opening the conversation…" : empty ? "Type a question first" : "Send (Enter)"}
            disabled={disabled || empty || opening}
            className="ai-send"
          >
            <ArrowUp className="size-[18px]" strokeWidth={2.2} aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
});
