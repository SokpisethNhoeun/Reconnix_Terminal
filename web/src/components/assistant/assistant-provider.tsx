"use client";

/* The AI Assistant's state, shared by the Overview's Ask bar and the assistant screen: the open
   conversation and its messages (use-open-conversation), asking, streaming, Stop and Retry
   (use-asking), the saved conversations for History and changes to them (use-history-list,
   use-conversation-changes), and what this tab remembers (use-tab-memory). The Viewer mounts it
   once, so switching views, the live refresh and the open/close animation never touch it.

   Conversations are kept by the dashboard's server (lib/assistant/history-store.ts): a
   question carries only the open conversation's id and the question, never the conversation
   so far. A conversation stays about the run it was started on. */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { MAX_QUESTION } from "@/lib/assistant/request";
import { createSlot } from "./slot";
import type { AssistantInfo, ChatMessage } from "./types";
import { useAsking } from "./use-asking";
import { useConversationChanges } from "./use-conversation-changes";
import { type HistoryState, useHistoryList } from "./use-history-list";
import { type OpenConversation, useOpenConversation } from "./use-open-conversation";
import { useTabMemory } from "./use-tab-memory";

export type { HistoryState, OpenConversation };

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
  notice: string | null; // why the last open didn't work
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

export function AssistantProvider({ info, children }: { info: AssistantInfo; children: React.ReactNode }) {
  const [draft, setDraftState] = useState("");
  const setDraft = useCallback((text: string) => setDraftState(text.slice(0, MAX_QUESTION)), []);
  const clearDraft = useCallback(() => setDraftState(""), []);
  const [stream] = useState(() => createSlot<AbortController>()); // the reply being streamed

  const list = useHistoryList(info.operator);
  const open = useOpenConversation(info, stream, list.forget);
  const asking = useAsking({ info, open, stream, draft, clearDraft, refreshHistory: list.refreshHistory });
  const changes = useConversationChanges(list, open);
  useTabMemory(info, open, draft, setDraft);

  const canAsk = info.operator && info.model.configured;
  const { messages, conversation, opening, notice, newChat, openConversation } = open;
  const { busy, ask, retry, stop } = asking;
  const { history, loadHistory } = list;
  const { renameConversation, deleteConversation, deleteAllConversations } = changes;
  const openSaved = useCallback((id: string) => void openConversation(id), [openConversation]);

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
      openConversation: openSaved,
      history,
      loadHistory,
      renameConversation,
      deleteConversation,
      deleteAllConversations,
    }),
    [info, canAsk, messages, draft, busy, setDraft, ask, stop, retry, conversation, opening, notice, newChat, openSaved, history, loadHistory, renameConversation, deleteConversation, deleteAllConversations],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
