"use client";

/* The AI Assistant's conversation: the messages, the draft (shared by the Overview's Ask bar
   and the assistant's composer), the reply being streamed and a way to stop it. The Viewer
   mounts it once, so switching views, the live refresh and the open/close animation never touch
   it; a reload in the same tab keeps it too (sessionStorage). Questions are masked as they are
   asked (lib/assistant/redact.ts), so a pasted token is never shown, kept or sent. They go to
   /api/assistant, which needs the operator role and reads the assessment data itself; only the
   turns about the same run (or about every run) go with them, so a reply about one run never
   travels into another's context. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ASSISTANT_ROUTE } from "@/lib/assistant/paths";
import { redact } from "@/lib/assistant/redact";
import { MAX_MESSAGES, MAX_QUESTION, MAX_REPLY } from "@/lib/assistant/request";
import type { AssistantInfo, ChatMessage } from "./types";

const STORE_KEY = "reconix.assistant.v1";
const KEEP = 60; // messages kept in the tab

interface Assistant {
  info: AssistantInfo;
  canAsk: boolean;
  messages: ChatMessage[];
  draft: string;
  busy: boolean;
  setDraft: (text: string) => void;
  /** Ask `text` (default: the draft). False when it can't be asked now (the draft stays). */
  ask: (text?: string) => boolean;
  stop: () => void;
  clear: () => void;
}

const AssistantContext = createContext<Assistant | null>(null);

export function useAssistant(): Assistant {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant needs an AssistantProvider above it.");
  return value;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function load(): { messages: ChatMessage[]; draft: string } | null {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { messages?: unknown; draft?: unknown };
    const messages = Array.isArray(data.messages)
      ? (data.messages as ChatMessage[])
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && typeof m.id === "string" && typeof m.scopeKey === "string")
          .map((m) => (m.state === "streaming" ? { ...m, state: "stopped" as const } : m)) // a reply cut by the reload
      : [];
    return { messages: messages.slice(-KEEP), draft: typeof data.draft === "string" ? data.draft.slice(0, MAX_QUESTION) : "" };
  } catch {
    return null;
  }
}

function save(messages: ChatMessage[], draft: string): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ messages: messages.slice(-KEEP), draft: redact(draft) }));
  } catch {
    // storage blocked or full: the conversation still lives in the page
  }
}

const scopeKeyOf = (info: AssistantInfo) => info.scope.uid ?? "all";

/** The history the route accepts: answered turns about this scope only, newest last, within
    its limits. */
function history(messages: ChatMessage[], scopeKey: string, question: string) {
  const turns = messages
    .filter((m) => m.scopeKey === scopeKey && m.state !== "error" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? MAX_QUESTION : MAX_REPLY) }));
  turns.push({ role: "user", content: question });
  // the route wants a user turn first after any cut, so drop a leading reply
  const recent = turns.slice(-MAX_MESSAGES);
  return recent[0]?.role === "assistant" ? recent.slice(1) : recent;
}

export function AssistantProvider({ info, children }: { info: AssistantInfo; children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraftState] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const restored = useRef(false);
  const latest = useRef({ messages, info });
  latest.current = { messages, info };
  const canAsk = info.operator && info.model.configured;

  // restore after hydration (the server knows nothing of this tab's storage)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = load();
      if (saved) {
        setMessages((now) => (now.length ? now : saved.messages)); // a question asked meanwhile wins
        setDraftState((now) => now || saved.draft);
      }
      restored.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (restored.current) save(messages, draft);
  }, [messages, draft]);
  useEffect(() => () => abort.current?.abort(), []);

  const setDraft = useCallback((text: string) => setDraftState(text.slice(0, MAX_QUESTION)), []);

  const patch = (id: string, change: (m: ChatMessage) => ChatMessage) =>
    setMessages((list) => list.map((m) => (m.id === id ? change(m) : m)));

  const ask = useCallback(
    (text?: string) => {
      const { info: now, messages: before } = latest.current;
      const question = redact((text ?? draft).trim().slice(0, MAX_QUESTION));
      if (!question || abort.current || !(now.operator && now.model.configured)) return false;
      const scope = now.scope.label;
      const scopeKey = scopeKeyOf(now);
      const reply: ChatMessage = { id: newId(), role: "assistant", content: "", scope, scopeKey, state: "streaming" };
      const asked: ChatMessage = { id: newId(), role: "user", content: question, scope, scopeKey };
      setMessages((list) => [...list, asked, reply].slice(-KEEP));
      if (text === undefined) setDraftState("");
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;

      void (async () => {
        try {
          const response = await fetch(ASSISTANT_ROUTE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: now.scope.uid, messages: history(before, scopeKey, question) }),
            signal: controller.signal,
          });
          if (!response.ok || !response.body) {
            const detail = ((await response.json().catch(() => null)) as { detail?: string } | null)?.detail;
            patch(reply.id, (m) => ({ ...m, content: detail ?? `The assistant could not answer (HTTP ${response.status}).`, state: "error" }));
            return;
          }
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) patch(reply.id, (m) => ({ ...m, content: (m.content + value).slice(0, MAX_REPLY * 2) }));
          }
          patch(reply.id, (m) => (m.content.trim() ? { ...m, state: undefined } : { ...m, content: "The model sent an empty answer.", state: "error" }));
        } catch {
          patch(reply.id, (m) =>
            controller.signal.aborted ? { ...m, state: "stopped" } : { ...m, content: m.content || "The connection to the assistant broke off.", state: "error" },
          );
        } finally {
          if (abort.current === controller) abort.current = null;
          setBusy(false);
        }
      })();
      return true;
    },
    [draft],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const clear = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
  }, []);

  const value = useMemo<Assistant>(
    () => ({ info, canAsk, messages, draft, busy, setDraft, ask, stop, clear }),
    [info, canAsk, messages, draft, busy, setDraft, ask, stop, clear],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
