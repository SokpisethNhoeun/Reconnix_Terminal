"use client";

/* The AI Assistant screen: the header (scope, model, History, New chat, minimize), the
   conversation in one centred column (the welcome and its globe slot while it is empty), and
   the composer. The three pieces carry data-assistant-piece so the open animation can bring
   them in as the surface settles. The conversation follows new text while the reader is at the
   bottom; scrolled up, "New messages" brings them back (useStickToBottom). */
import { forwardRef, useEffect } from "react";
import Link from "next/link";
import { Info, Loader, ShieldAlert } from "lucide-react";
import { useAssistant } from "./assistant-provider";
import { AssistantHeader } from "./assistant-header";
import { Composer } from "./composer";
import { Message } from "./message";
import { ScrollToBottom } from "./scroll-to-bottom";
import { useStickToBottom } from "./use-stick-to-bottom";
import { Welcome } from "./welcome";

function Reason({ tone = "warning", id, children }: { tone?: "warning" | "info"; id?: string; children: React.ReactNode }) {
  const Icon = tone === "info" ? Info : ShieldAlert;
  return (
    <div id={id} className="ai-reason" data-tone={tone} role="note">
      <Icon className="size-3.5" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const AssistantView = forwardRef<HTMLTextAreaElement, { onMinimize: () => void }>(function AssistantView({ onMinimize }, composerRef) {
  const { info, canAsk, messages, busy, retry, conversation, opening, notice, newChat } = useAssistant();
  const { ref: scroller, atBottom, scrollToBottom } = useStickToBottom<HTMLDivElement>();
  const { model } = info;

  // a question just asked, or another conversation opened: show its end
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    if (lastUser) scrollToBottom();
  }, [lastUser, conversation.id, scrollToBottom]);
  // the welcome reads from the top (the scroller otherwise starts at its end)
  const welcome = messages.length === 0 && !opening;
  useEffect(() => {
    if (welcome) scroller.current?.scrollTo({ top: 0 });
  }, [welcome, scroller]);

  const reason = !info.operator
    ? "Asking the AI model needs the operator role. Open the dashboard with the sign-in link /web prints."
    : !model.configured
      ? model.reason
      : null;
  const elsewhere = conversation.id !== null && conversation.scope.uid !== info.scope.uid;
  const last = messages[messages.length - 1];

  return (
    <section aria-label="AI Assistant" className="ai-view">
      <AssistantHeader onMinimize={onMinimize} />

      <div data-assistant-piece className="ai-conversation">
        <div ref={scroller} role="log" aria-label="Conversation" aria-busy={busy || opening} tabIndex={0} data-lenis-prevent className="ai-scroll">
          <div className={welcome ? "ai-column is-fill" : "ai-column"}>
            {opening ? (
              <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground" role="status">
                <Loader className="size-4 animate-spin" aria-hidden /> Opening the conversation…
              </p>
            ) : messages.length === 0 ? (
              <>
                {notice && (
                  <div className="pt-6">
                    <Reason tone="info">{notice}</Reason>
                  </div>
                )}
                <Welcome />
              </>
            ) : (
              <ol className="ai-messages">
                {messages.map((m) => (
                  <li key={m.id}>
                    <Message m={m} onRetry={m === last && m.state === "error" && !busy ? retry : undefined} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <ScrollToBottom show={!atBottom && messages.length > 0} onClick={scrollToBottom} className="ai-scroll-down" />
      </div>

      <div data-assistant-piece className="ai-composer-area">
        <div className="ai-column">
          {reason ? (
            <Reason id="ai-composer-reason">
              {reason}{" "}
              <Link href="/docs/guardrails/llm-data-handling" className="ai-link">
                What the model sees
              </Link>
            </Reason>
          ) : model.configured && !model.local ? (
            <Reason>This model is not on this machine: your questions and the assessment data they need are sent to it (LLM_BASE_URL).</Reason>
          ) : elsewhere ? (
            <Reason tone="info">
              This conversation is about {conversation.scope.label}; the dashboard shows {info.scope.label}.{" "}
              <button type="button" onClick={newChat} className="ai-link">
                New chat about {info.scope.label}
              </button>
            </Reason>
          ) : null}
          <Composer ref={composerRef} label={`Ask about ${conversation.scope.label}`} disabledReason={canAsk ? null : (reason ?? "Asking isn't available.")} />
          <p className="ai-footnote">Answers use your saved assessment data only. The assistant can&apos;t run scans or approve actions: that stays in the TUI.</p>
        </div>
      </div>
    </section>
  );
});
