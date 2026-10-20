"use client";

/* The AI Assistant's chat. This preview has no AI backend, so a sent message is echoed into
   the transcript with a canned reply that points to the terminal app; nothing runs. The
   transcript fills the page and the composer stays pinned at the bottom, like a chat app. */
import { ArrowUp, Diamond, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = value.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "you", text }]);
    setValue("");
    window.setTimeout(() => setMessages((m) => [...m, { role: "reconix", text: REPLY }]), 450);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Transcript — grows and scrolls above the composer */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {messages.length === 0 ? (
          <div className="m-auto flex max-w-md flex-col items-center gap-3 text-center">
            <Diamond size={30} className="text-accent" aria-hidden />
            <p className="text-[17px] font-semibold">Ask Reconix, or type a target to begin</p>
            <p className="text-[13px] text-muted">A read-only preview · run assessments in the terminal app.</p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-6">
            {messages.map((m, i) =>
              m.role === "you" ? (
                <p key={i} className="chat-you">
                  {m.text}
                </p>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className="eyebrow mt-1 flex flex-none items-center gap-1.5">
                    <Diamond size={13} aria-hidden />
                    reconix
                  </span>
                  <p className="text-[14.5px] leading-relaxed [overflow-wrap:anywhere]">{m.text}</p>
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer — pinned to the bottom */}
      <div className="mx-auto w-full max-w-4xl pt-4">
        <div className="card gap-3.5 !p-4">
          <div className="flex items-center gap-3">
            <button type="button" className="btn flex-none !px-3" aria-label="Add file">
              <Paperclip size={17} aria-hidden />
            </button>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Write a message…"
              aria-label="Message the AI Assistant"
              className="h-12 flex-1 text-[15px]"
            />
            <button
              type="button"
              onClick={send}
              className="btn flex-none !bg-accent !px-4 font-semibold !text-accent-ink [&_svg]:!text-accent-ink"
            >
              Send
              <ArrowUp size={17} aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap gap-2.5 text-[13px] text-muted">
            <span className="btn">
              <Diamond size={14} aria-hidden />
              Reconix model ▾
            </span>
          </div>
        </div>
        <p className="mt-2.5 text-center text-[12px] text-faint">
          A preview of the AI Assistant · run assessments in the terminal app.
        </p>
      </div>
    </div>
  );
}
