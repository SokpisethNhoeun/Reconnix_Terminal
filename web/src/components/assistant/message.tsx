"use client";

/* One message of the conversation. The operator's: a bubble on the right. The assistant's:
   beside the orb, full width, the verified cards first (built by the server from the saved
   data), then the model's text as Markdown, then Copy; "Stopped" after Stop, and an error card
   with Retry when it failed. */
import { CircleStop } from "lucide-react";
import type { CardOf } from "@/lib/assistant/protocol";
import { AssistantOrb } from "./assistant-orb";
import { CardView, NoticeCard } from "./cards";
import { CopyButton } from "@/components/ui/copy-button";
import { MessageText } from "./message-text";
import type { ChatMessage } from "./types";

const failed = (detail: string | undefined): CardOf<"notice"> => ({
  kind: "notice",
  tone: "danger",
  title: "The assistant couldn't answer",
  body: detail || "Something went wrong while answering.",
  steps: [],
  action: null,
});

export function Message({ m, onRetry }: { m: ChatMessage; onRetry?: () => void }) {
  if (m.role === "user") {
    return (
      <div className="ai-row-user">
        <p className="ai-bubble">{m.content}</p>
      </div>
    );
  }
  const streaming = m.state === "streaming";
  const waiting = streaming && !m.content && !m.cards?.length;
  return (
    <div className="ai-row-assistant">
      <AssistantOrb size={26} live={streaming} className="ai-avatar" />
      <div className="ai-reply">
        <span className="sr-only">Reconix AI:</span>
        {m.cards?.map((card, i) => <CardView key={i} card={card} />)}
        {m.content ? <MessageText text={m.content} /> : null}
        {waiting && (
          <span className="ai-typing" role="status" aria-label="The assistant is answering">
            <span />
            <span />
            <span />
          </span>
        )}
        {m.state === "error" && <NoticeCard card={failed(m.detail)} onRetry={onRetry} />}
        {m.state === "stopped" && (
          <span className="ai-stopped">
            <CircleStop className="size-3.5" aria-hidden /> Stopped
          </span>
        )}
        {!streaming && m.content.trim() && (
          <div className="ai-actions">
            <CopyButton text={m.content} label="Copy this answer" />
          </div>
        )}
      </div>
    </div>
  );
}
