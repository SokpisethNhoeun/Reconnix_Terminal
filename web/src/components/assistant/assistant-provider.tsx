"use client";

/* The AI Assistant's state: the open conversation and its messages, the draft (shared by the
   Overview's Ask bar and the composer), the reply being streamed and a way to stop it, and the
   saved conversations for the History menu. The Viewer mounts it once, so switching views, the
   live refresh and the open/close animation never touch it.

   Conversations are kept by the dashboard's server (lib/assistant/history-store.ts): a
   question carries only the open conversation's id and the question, never the conversation
   so far. This tab keeps only which conversation is open (and for which view) and the unsent
   draft (masked), in sessionStorage, so a reload reopens it. Questions are masked as they are asked
   (lib/assistant/redact.ts). A conversation stays about the run it was started on; when the
   dashboard moves to another run, the next question starts a new conversation about that one
   (the old one stays in History). */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import * as api from "@/lib/assistant/client";
import type { Conversation, ConversationSummary } from "@/lib/assistant/history-schema";
import { MAX_CARDS, type ScopeRef } from "@/lib/assistant/protocol";
import { redact } from "@/lib/assistant/redact";
import { MAX_QUESTION } from "@/lib/assistant/request";
import type { AssistantInfo, ChatMessage } from "./types";

const STORE_KEY = "reconix.assistant.v2"; // { openId, pageUid, draft }
const OLD_KEY = "reconix.assistant.v1"; // the earlier copy of whole conversations: removed
const MAX_SHOWN = 40_000; // characters of one streamed reply kept on screen

export interface OpenConversation {
  id: string | null; // null: a new chat, saved with its first question
  title: string;
  scope: ScopeRef; // what it is about (a new chat: what the dashboard shows)
}

export interface HistoryState {
  status: "idle" | "loading" | "ready" | "error";
  items: ConversationSummary[];
  error: string | null;
}

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
  /** Ask the last failed question again (its error is replaced). */
  retry: () => void;
  conversation: OpenConversation;
  opening: boolean; // a saved conversation is being read
  notice: string | null; // why the last open or change didn't work
  newChat: () => void;
  openConversation: (id: string) => void;
  history: HistoryState;
  loadHistory: () => void;
  /** Each resolves to null when it worked, or what went wrong. */
  renameConversation: (id: string, title: string) => Promise<string | null>;
  deleteConversation: (id: string) => Promise<string | null>;
  deleteAllConversations: () => Promise<string | null>;
}

const AssistantContext = createContext<Assistant | null>(null);

export function useAssistant(): Assistant {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant needs an AssistantProvider above it.");
  return value;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

interface Kept {
  openId: string | null; // the open conversation
  pageUid: string | null | undefined; // what the dashboard showed then (a reload of it reopens it)
  draft: string;
}

function load(): Kept {
  try {
    window.sessionStorage.removeItem(OLD_KEY);
    const raw = window.sessionStorage.getItem(STORE_KEY);
    const data = raw ? (JSON.parse(raw) as { openId?: unknown; pageUid?: unknown; draft?: unknown }) : {};
    return {
      openId: typeof data.openId === "string" ? data.openId : null,
      pageUid: typeof data.pageUid === "string" || data.pageUid === null ? data.pageUid : undefined,
      draft: typeof data.draft === "string" ? data.draft.slice(0, MAX_QUESTION) : "",
    };
  } catch {
    return { openId: null, pageUid: undefined, draft: "" };
  }
}

function save({ openId, pageUid, draft }: Kept): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ openId, pageUid, draft: redact(draft) }));
  } catch {
    // storage blocked or full: the page still works, a reload just starts fresh
  }
}

/** A saved conversation as the page shows it. */
export function toMessages(c: Conversation): ChatMessage[] {
  const questions = new Map(c.messages.filter((m) => m.role === "user").map((m) => [m.id, m.content]));
  return c.messages.map((m) =>
    m.role === "user"
      ? { id: m.id, role: "user", content: m.content }
      : {
          id: m.id,
          role: "assistant",
          content: m.content,
          cards: m.cards,
          state: m.state === "done" ? undefined : m.state,
          detail: m.detail,
          question: questions.get(m.replyTo),
        },
  );
}

const pageScope = (info: AssistantInfo): ScopeRef => ({ uid: info.scope.uid, label: info.scope.label });

export function AssistantProvider({ info, children }: { info: AssistantInfo; children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraftState] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<OpenConversation | null>(null); // null: a new chat
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState>({ status: "idle", items: [], error: null });
  const abort = useRef<AbortController | null>(null);
  const reading = useRef<AbortController | null>(null); // opening a saved conversation
  const restored = useRef(false);
  const latest = useRef({ info, opened, messages, history });
  useLayoutEffect(() => {
    latest.current = { info, opened, messages, history };
  });
  const canAsk = info.operator && info.model.configured;

  const conversation = useMemo<OpenConversation>(() => opened ?? { id: null, title: "", scope: pageScope(info) }, [opened, info]);

  // --- history -----------------------------------------------------------------------------

  const loadHistory = useCallback(() => {
    if (!latest.current.info.operator) return;
    setHistory((h) => ({ ...h, status: h.status === "ready" ? "ready" : "loading", error: null }));
    void api.listConversations().then((result) =>
      setHistory((h) => (result.ok ? { status: "ready", items: result.conversations, error: null } : { ...h, status: "error", error: result.detail })),
    );
  }, []);
  const refreshHistory = useCallback(() => {
    if (latest.current.history.status !== "idle") loadHistory();
  }, [loadHistory]);

  // --- opening and starting conversations --------------------------------------------------

  const halt = useCallback(() => {
    abort.current?.abort();
    reading.current?.abort();
  }, []);

  const newChat = useCallback(() => {
    halt();
    setOpened(null);
    setMessages([]);
    setOpening(false);
    setNotice(null);
  }, [halt]);

  const openConversation = useCallback((id: string) => {
    halt();
    const controller = new AbortController();
    reading.current = controller;
    setOpening(true);
    setNotice(null);
    void api
      .readConversation(id, controller.signal)
      .then((result) => {
        if (reading.current !== controller) return;
        if (result.ok) {
          const c = result.conversation;
          setOpened({ id: c.id, title: c.title, scope: c.scope });
          setMessages(toMessages(c));
        } else {
          setOpened(null);
          setMessages([]);
          setNotice(result.status === 404 ? "That conversation is not saved any more." : result.detail);
          if (result.status === 404) setHistory((h) => ({ ...h, items: h.items.filter((x) => x.id !== id) }));
        }
      })
      .catch(() => undefined) // replaced by another open
      .finally(() => {
        if (reading.current === controller) {
          reading.current = null;
          setOpening(false);
        }
      });
  }, [halt]);

  // restore after hydration (the server knows nothing of this tab's storage)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = load();
      setDraftState((now) => now || saved.draft);
      const { info: now, opened: open, messages: shown } = latest.current;
      // a reload of the same view reopens its conversation; another run's page starts fresh
      if (saved.openId && saved.pageUid === now.scope.uid && now.operator && !open && !shown.length) openConversation(saved.openId);
      restored.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [openConversation]);
  useEffect(() => {
    if (restored.current) save({ openId: opened?.id ?? null, pageUid: info.scope.uid, draft });
  }, [opened, draft, info.scope.uid]);
  useEffect(() => halt, [halt]);

  // the dashboard moved to another run: the next question starts a conversation about it
  const pageUid = info.scope.uid;
  const shownUid = useRef(pageUid);
  useEffect(() => {
    if (shownUid.current === pageUid) return;
    shownUid.current = pageUid;
    const now = latest.current.opened;
    if (now && now.scope.uid !== pageUid && !abort.current) newChat();
  }, [pageUid, newChat]);

  // --- asking --------------------------------------------------------------------------------

  const setDraft = useCallback((text: string) => setDraftState(text.slice(0, MAX_QUESTION)), []);

  const patch = useCallback((id: string, change: (m: ChatMessage) => ChatMessage) => setMessages((list) => list.map((m) => (m.id === id ? change(m) : m))), []);

  const send = useCallback(
    (question: string, retry: boolean): boolean => {
      const { info: now, opened: open } = latest.current;
      if (!question || abort.current || reading.current || !(now.operator && now.model.configured)) return false;
      const asked: ChatMessage = { id: newId(), role: "user", content: question };
      const reply: ChatMessage = { id: newId(), role: "assistant", content: "", cards: [], state: "streaming", question };
      setMessages((list) => [...list, asked, reply]);
      setNotice(null);
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;

      void (async () => {
        try {
          const result = await api.askQuestion({ conversationId: open?.id ?? undefined, uid: now.scope.uid, question, retry }, controller.signal, (frame) => {
            if (frame.t === "meta") setOpened({ id: frame.conversationId, title: frame.title, scope: frame.scope });
            else if (frame.t === "card") patch(reply.id, (m) => ({ ...m, cards: [...(m.cards ?? []), frame.card].slice(0, MAX_CARDS) }));
            else if (frame.t === "text") patch(reply.id, (m) => ({ ...m, content: (m.content + frame.delta).slice(0, MAX_SHOWN) }));
            else if (frame.t === "error") patch(reply.id, (m) => ({ ...m, state: "error", detail: frame.detail }));
          });
          if (!result.ok) {
            patch(reply.id, (m) => ({ ...m, state: "error", detail: result.detail }));
            if (result.status === 404 && open?.id) setOpened(null); // gone: Retry starts a new conversation
            return;
          }
          patch(reply.id, (m) =>
            m.state === "error" ? m : result.complete ? { ...m, state: undefined } : { ...m, state: "error", detail: "The answer broke off before it ended." },
          );
        } catch {
          patch(reply.id, (m) => (controller.signal.aborted ? { ...m, state: "stopped" } : { ...m, state: "error", detail: "The connection to the assistant broke off." }));
        } finally {
          if (abort.current === controller) abort.current = null;
          setBusy(false);
          refreshHistory();
        }
      })();
      return true;
    },
    [patch, refreshHistory],
  );

  const ask = useCallback(
    (text?: string) => {
      const question = redact((text ?? draft).trim().slice(0, MAX_QUESTION));
      const sent = send(question, false);
      if (sent && text === undefined) setDraftState("");
      return sent;
    },
    [draft, send],
  );

  const retry = useCallback(() => {
    const last = latest.current.messages.at(-1);
    if (!last || last.role !== "assistant" || last.state !== "error" || !last.question || abort.current) return;
    const question = last.question;
    setMessages((list) => list.slice(0, -2)); // the failed question and its error
    send(question, true);
  }, [send]);

  const stop = useCallback(() => abort.current?.abort(), []);

  // --- changes to saved conversations --------------------------------------------------------

  const renameConversation = useCallback(async (id: string, title: string) => {
    const result = await api.renameConversation(id, title);
    if (!result.ok) return result.detail;
    setHistory((h) => ({ ...h, items: h.items.map((x) => (x.id === id ? { ...x, title: result.title } : x)) }));
    setOpened((o) => (o && o.id === id ? { ...o, title: result.title } : o));
    return null;
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      const result = await api.deleteConversation(id);
      if (!result.ok && result.status !== 404) return result.detail;
      setHistory((h) => ({ ...h, items: h.items.filter((x) => x.id !== id) }));
      if (latest.current.opened?.id === id) newChat();
      return null;
    },
    [newChat],
  );

  const deleteAllConversations = useCallback(async () => {
    const result = await api.deleteAllConversations();
    if (!result.ok) return result.detail;
    setHistory({ status: "ready", items: [], error: null });
    newChat();
    return null;
  }, [newChat]);

  const value = useMemo<Assistant>(
    () => ({
      info,
      canAsk,
      messages,
      draft,
      busy,
      setDraft,
      ask,
      stop,
      retry,
      conversation,
      opening,
      notice,
      newChat,
      openConversation,
      history,
      loadHistory,
      renameConversation,
      deleteConversation,
      deleteAllConversations,
    }),
    [info, canAsk, messages, draft, busy, setDraft, ask, stop, retry, conversation, opening, notice, newChat, openConversation, history, loadHistory, renameConversation, deleteConversation, deleteAllConversations],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
