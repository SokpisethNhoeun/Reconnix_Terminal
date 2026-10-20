"use client";

/* The AI Assistant screen: a header with the run in scope (or every run) and its key numbers,
   the model and a minimize control; the conversation; the composer. The pieces carry
   data-assistant-piece so the open animation can bring them in as the surface settles. */
import { forwardRef, useEffect, useRef } from "react";
import Link from "next/link";
import { Minimize2, RotateCcw, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";
import { AssistantOrb } from "./assistant-orb";
import { Composer } from "./composer";
import { MessageText } from "./message-text";
import type { ChatMessage } from "./types";

const LINK = "rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ICON_BTN =
  "grid size-9 shrink-0 place-items-center rounded-[10px] border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[min(560px,85%)] whitespace-pre-wrap rounded-2xl rounded-br-md border border-primary/25 bg-primary/10 px-3.5 py-2 text-sm text-foreground [overflow-wrap:anywhere]">
          {m.content}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <AssistantOrb size={22} className="mt-1 shrink-0" />
      <div className={cn("min-w-0 max-w-[min(680px,90%)] text-sm leading-relaxed", m.state === "error" ? "text-danger" : "text-muted-foreground")}>
        {m.content ? <MessageText text={m.content} /> : <span className="dash-typing" role="status" aria-label="The assistant is answering" />}
        {m.state === "stopped" && <p className="mt-1 font-mono text-[10px] text-muted-foreground">stopped</p>}
      </div>
    </div>
  );
}

export const AssistantView = forwardRef<HTMLTextAreaElement, { onMinimize: () => void }>(function AssistantView({ onMinimize }, composerRef) {
  const { info, canAsk, messages, ask, setDraft, clear, busy } = useAssistant();
  const log = useRef<HTMLDivElement>(null);
  const pinned = useRef(true); // follow new text unless the operator scrolled up

  useEffect(() => {
    const el = log.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const pick = (q: string) => {
    if (!canAsk || !ask(q)) setDraft(q);
  };
  const { scope, model } = info;

  return (
    <section aria-label="AI Assistant" className="flex h-full min-h-0 flex-col">
      <header data-assistant-piece className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <AssistantOrb size={34} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-medium leading-tight text-foreground">AI Assistant</h1>
          <p className="truncate text-xs text-muted-foreground">
            <span className="text-foreground">{scope.label}</span>
            {scope.detail ? ` · ${scope.detail}` : ""}
          </p>
        </div>
        <ul aria-label="In scope" className="hidden items-center gap-1.5 lg:flex">
          {scope.chips.map((c) => (
            <li key={c} className="dash-chip h-[26px] border border-border px-2 text-[10px] text-muted-foreground">
              {c}
            </li>
          ))}
        </ul>
        <span className="hidden sm:inline-flex">
          <span
            className="dash-chip h-[26px] border border-border px-2 text-[10px]"
            title={model.configured ? (model.local ? "A local endpoint (LLM_BASE_URL on this machine)" : "A remote model: questions and assessment data are sent to it") : model.reason}
          >
            <span aria-hidden className={cn("size-1.5 rounded-full", model.configured ? "bg-success" : "bg-accent")} />
            <span className="max-w-[140px] truncate text-muted-foreground">{model.configured ? `${model.name} · ${model.local ? "local" : "remote"}` : "model not set up"}</span>
          </span>
        </span>
        {messages.length > 0 && (
          <button type="button" onClick={clear} aria-label="New conversation" title="New conversation" className={ICON_BTN}>
            <RotateCcw className="size-4" aria-hidden />
          </button>
        )}
        <button type="button" onClick={onMinimize} aria-label="Back to the dashboard" title="Back to the dashboard" className={ICON_BTN}>
          <Minimize2 className="size-4" aria-hidden />
        </button>
      </header>

      <div
        ref={log}
        data-assistant-piece
        role="log"
        aria-label="Conversation"
        aria-busy={busy}
        data-lenis-prevent
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 pt-[6vh] text-center">
            <AssistantOrb size={96} />
            <div>
              <p className="text-[19px] font-medium text-foreground">Ask about {scope.uid ? scope.label : "your assessments"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Answers come from the saved assessment data only. Decisions and approvals stay in the Reconix TUI.
              </p>
            </div>
            {info.questions.length > 0 && (
              <ul aria-label="Suggested questions" className="flex flex-wrap justify-center gap-2">
                {info.questions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => pick(q)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ol className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m, i) => (
              <li key={m.id}>
                {i > 0 && m.role === "user" && messages[i - 1].scope !== m.scope && (
                  <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Now about {m.scope}</p>
                )}
                <Bubble m={m} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div data-assistant-piece className="px-3 pb-3 sm:px-5 sm:pb-4">
        {!info.operator ? (
          <p className="mb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
            Asking the AI model needs the operator role. Open the dashboard with the sign-in link /web prints.
          </p>
        ) : model.configured && !model.local ? (
          <p className="mb-2 flex items-start gap-2 text-xs text-accent">
            <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            This model is not on this machine: your questions and the assessment data they need are sent to it (LLM_BASE_URL).
          </p>
        ) : !model.configured ? (
          <p className="mb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
            <span>
              {model.reason}{" "}
              <Link href="/docs/guardrails/llm-data-handling" className={LINK}>
                What the model sees
              </Link>
            </span>
          </p>
        ) : null}
        <div className="mx-auto max-w-3xl">
          <Composer ref={composerRef} label={`Ask about ${scope.uid ? scope.label : "your assessments"}`} />
        </div>
      </div>
    </section>
  );
});
