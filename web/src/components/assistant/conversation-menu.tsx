"use client";

/* The History menu: the saved conversations (kept by the dashboard's server on this computer),
   newest first and grouped by day. Each can be opened, renamed or deleted; "Delete all" asks
   first. Escape or a click outside closes it and focus goes back to its button. Operators
   only: a viewer sees the button disabled with the reason. */
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, History, Loader, Pencil, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "@/lib/assistant/history-schema";
import { MAX_TITLE } from "@/lib/assistant/history-schema";
import { ago, type Group, groupOf } from "@/lib/assistant/when";
import { useAssistant } from "./assistant-provider";

const GROUPS: Group[] = ["Today", "Yesterday", "Previous 7 days", "Older"];

function Row({ c, now, active, onOpen }: { c: ConversationSummary; now: number; active: boolean; onOpen: () => void }) {
  const { renameConversation, deleteConversation } = useAssistant();
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [title, setTitle] = useState(c.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = title.trim();
    if (!next) return setError("Give it a name.");
    if (next === c.title) return setMode("idle");
    setSaving(true);
    const problem = await renameConversation(c.id, next);
    setSaving(false);
    if (problem) setError(problem);
    else setMode("idle");
  };
  const remove = async () => {
    setSaving(true);
    const problem = await deleteConversation(c.id);
    setSaving(false);
    if (problem) setError(problem);
  };

  if (mode === "rename") {
    return (
      <li className="ai-menu-edit">
        <form onSubmit={rename} className="flex items-center gap-1.5">
          <input
            autoFocus
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setMode("idle");
              }
            }}
            aria-label="Conversation name"
            className="ai-input"
          />
          <button type="submit" disabled={saving} aria-label="Save the name" className="ai-btn ai-btn-square ai-btn-small">
            <Check className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setMode("idle")} aria-label="Cancel renaming" className="ai-btn ai-btn-square ai-btn-small">
            <X className="size-4" aria-hidden />
          </button>
        </form>
        {error && <p className="ai-error-text mt-1 px-1">{error}</p>}
      </li>
    );
  }
  if (mode === "delete") {
    return (
      <li className="ai-menu-confirm" role="group" aria-label={`Delete ${c.title}?`}>
        <p className="text-foreground">
          Delete <span className="font-medium">“{c.title}”</span>? This can&apos;t be undone.
        </p>
        {error && <p className="ai-error-text mt-1">{error}</p>}
        <div className="mt-2 flex justify-end gap-1.5">
          <button type="button" autoFocus onClick={() => setMode("idle")} className="ai-btn ai-btn-small ai-btn-outline">
            Cancel
          </button>
          <button type="button" onClick={remove} disabled={saving} className="ai-btn ai-btn-small ai-btn-danger-solid">
            Delete
          </button>
        </div>
      </li>
    );
  }
  return (
    <li className="ai-menu-item" data-active={active ? "" : undefined}>
      <button type="button" onClick={onOpen} aria-current={active ? "true" : undefined} className="ai-menu-open">
        <span className="ai-menu-title">{c.title}</span>
        <span className="ai-menu-meta">
          {c.scope.label} · {ago(c.updatedAt, now)}
        </span>
      </button>
      <span className="ai-menu-actions">
        <button
          type="button"
          onClick={() => {
            setTitle(c.title);
            setError(null);
            setMode("rename");
          }}
          aria-label={`Rename “${c.title}”`}
          title="Rename"
          className="ai-btn ai-btn-square ai-btn-small"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("delete");
          }}
          aria-label={`Delete “${c.title}”`}
          title="Delete"
          className="ai-btn ai-btn-square ai-btn-small ai-btn-danger"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </span>
    </li>
  );
}

export function ConversationMenu() {
  const { info, history, loadHistory, openConversation, conversation, deleteAllConversations } = useAssistant();
  const [open, setOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = (refocus = true) => {
    setOpen(false);
    setConfirmAll(false);
    setAllError(null);
    if (refocus) button.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || button.current?.contains(t)) return;
      setOpen(false);
      setConfirmAll(false);
      setAllError(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const toggle = () => {
    if (open) return close();
    setNow(Date.now());
    setOpen(true);
    loadHistory();
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true }));
  };

  if (!info.operator) {
    return (
      <button type="button" disabled className="ai-btn" title="The saved conversations need the operator role" aria-label="History (needs the operator role)">
        <History className="size-4" aria-hidden />
        <span className="ai-btn-label">History</span>
      </button>
    );
  }

  const groups = GROUPS.map((g) => ({ g, items: history.items.filter((c) => groupOf(c.updatedAt, now) === g) })).filter((x) => x.items.length);
  const days = info.retentionDays;

  return (
    <>
      <button ref={button} type="button" onClick={toggle} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" className="ai-btn">
        <History className="size-4" aria-hidden />
        <span className="ai-btn-label">History</span>
        <ChevronDown className="ai-btn-chevron size-3.5 opacity-70" aria-hidden />
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label="Conversation history"
          className="ai-menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="ai-menu-head">
            <p className="ai-menu-heading">Conversations</p>
            <button type="button" onClick={() => close()} aria-label="Close the history" className="ai-btn ai-btn-square ai-btn-small">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="ai-menu-list" data-lenis-prevent>
            {history.status === "loading" && !history.items.length ? (
              <p className="ai-menu-state" role="status">
                <Loader className="mr-1.5 inline size-3.5 animate-spin" aria-hidden /> Loading conversations…
              </p>
            ) : history.status === "error" ? (
              <div className="ai-menu-state" role="alert">
                <p>Couldn&apos;t load the history: {history.error}</p>
                <button type="button" onClick={loadHistory} className="ai-btn ai-btn-small ai-btn-outline mt-2">
                  Try again
                </button>
              </div>
            ) : !history.items.length ? (
              <p className="ai-menu-state">No saved conversations yet. Questions you ask are kept here{days ? ` for ${days} days` : ""}.</p>
            ) : (
              groups.map(({ g, items }) => (
                <section key={g} aria-label={g}>
                  <p className="ai-menu-group">{g}</p>
                  <ul>
                    {items.map((c) => (
                      <Row
                        key={c.id}
                        c={c}
                        now={now}
                        active={c.id === conversation.id}
                        onOpen={() => {
                          close();
                          if (c.id !== conversation.id) openConversation(c.id);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
          <div className="ai-menu-foot">
            {confirmAll ? (
              <div className="flex w-full flex-col gap-2" role="group" aria-label="Delete all conversations?">
                <p className="text-[12.5px] text-foreground">Delete all {history.items.length} conversations? This can&apos;t be undone.</p>
                {allError && <p className="ai-error-text">{allError}</p>}
                <div className="flex justify-end gap-1.5">
                  <button type="button" autoFocus onClick={() => setConfirmAll(false)} className="ai-btn ai-btn-small ai-btn-outline">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const problem = await deleteAllConversations();
                      if (problem) setAllError(problem);
                      else setConfirmAll(false);
                    }}
                    className="ai-btn ai-btn-small ai-btn-danger-solid"
                  >
                    Delete all conversations
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span>{days ? `Kept on this computer for ${days} days without use` : "Kept on this computer until deleted"}</span>
                <button type="button" onClick={() => setConfirmAll(true)} disabled={!history.items.length} className="ai-btn ai-btn-small ai-btn-danger">
                  Delete all
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
