"use client";

/* The AI Assistant's composer. This preview has no AI backend, so a sent message is echoed
   into the transcript with a canned reply that points to the terminal app; nothing runs. */
import { ArrowRight, Diamond, Paperclip } from "lucide-react";
import { useState } from "react";

import { Input } from "../ui/input";

interface Message {
  role: "you" | "reconix";
  text: string;
}

const REPLY =
  "This is a read-only preview of the AI Assistant. Run assessments in the terminal app (or with `reconix` on this computer) and they show up here, with the same scope and approval gates.";

export function Composer() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const send = () => {
    const text = value.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "you", text }]);
    setValue("");
    window.setTimeout(() => setMessages((m) => [...m, { role: "reconix", text: REPLY }]), 450);
  };

  return (
    <>
      {messages.length > 0 && (
        <div className="flex flex-col gap-5">
          {messages.map((m, i) =>
            m.role === "you" ? (
              <p key={i} className="chat-you">
                {m.text}
              </p>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="eyebrow mt-0.5 flex flex-none items-center gap-1.5">
                  <Diamond size={12} aria-hidden />
                  reconix
                </span>
                <p className="text-[13.5px] leading-relaxed [overflow-wrap:anywhere]">{m.text}</p>
              </div>
            ),
          )}
        </div>
      )}

      <div className="card gap-3">
        <div className="flex items-end gap-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a target (URL, IPv4, repo or path), ask a question, or / for commands"
            aria-label="Message the AI Assistant"
            className="h-11 flex-1"
          />
          <button type="button" onClick={send} className="btn !bg-accent !text-accent-ink font-semibold">
            Send
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap gap-2.5 text-[12.5px] text-muted">
          <span className="btn">
            <Paperclip size={14} aria-hidden />
            Add file
          </span>
          <span className="btn">
            <Diamond size={13} aria-hidden />
            Reconix model ▾
          </span>
          <span className="btn">Explain this risk</span>
          <span className="btn">What will this change?</span>
        </div>
        <p className="text-[11.5px] text-faint">A preview of the AI Assistant · run assessments in the terminal app.</p>
      </div>
    </>
  );
}
