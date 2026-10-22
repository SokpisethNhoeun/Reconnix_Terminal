"use client";

/* The Model menu in the assistant's header: its button names the model that answers next
   (`name · local|remote`, or "Add a model"); its panel lists every model (the Environment's
   from web/.env.local first, read-only, then the saved providers) and switches in one click,
   edits and removes a saved provider, and + Add model opens the form in the same panel.
   Opening it focuses the active model once the list has loaded (the first open waits for it).
   Escape or a click outside closes it and focus goes back to its button (Escape inside the form
   only closes the form). A provider removed meanwhile (another tab) is never edited: its form
   gives way to the list, which says so. Operators only: a viewer sees the button disabled with
   the reason. Its own panel, like History (conversation-menu.tsx): the form's Escape must stay
   inside. */
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Cpu, Plus, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { MAX_PROVIDERS } from "@/lib/assistant/models/schema";
import { useAssistant } from "./assistant-provider";
import { ModelForm } from "./model-form";
import { ACTIVE_ITEM, ModelList, TAB_STOP_ITEM } from "./model-list";
import type { ModelSummary } from "./types";
import { useFitBelow } from "./use-fit-below";
import { useModels } from "./use-models";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; id: string };

/** Focuses the first of `selectors` (in that order) found in `root`, once it has rendered. */
const focusIn = (root: RefObject<HTMLElement | null>, ...selectors: string[]) =>
  requestAnimationFrame(() => {
    for (const selector of selectors) {
      const el = root.current?.querySelector<HTMLElement>(selector);
      if (el) return el.focus({ preventScroll: true });
    }
  });

/** What the button says: the model and where it runs, or that there is none yet. */
export function modelLabel(model: ModelSummary): string {
  if (!model.name) return "Add a model";
  return `${model.name} · ${model.configured ? (model.local ? "local" : "remote") : "unavailable"}`;
}

function modelTitle(model: ModelSummary): string {
  if (!model.configured) return model.reason;
  const from = model.provider ? ` (${model.provider})` : "";
  return model.local
    ? `${model.name}${from}: a local endpoint on this machine`
    : `${model.name}${from}: a remote model. Questions, the assessment data they need and relevant /add-on knowledge passages are sent to it.`;
}

export function ModelMenu() {
  const { info, setModel } = useAssistant();
  const models = useModels(info.operator, setModel);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opening = useRef(false); // just opened: focus goes into the list once it is there
  const id = useId();
  const { model } = info;
  const label = modelLabel(model);
  const tone = model.configured ? "success" : "warning";
  const status = models.state.status;
  const view = models.state.view;
  const editing = mode.kind === "edit" ? (view?.providers.find((p) => p.id === mode.id) ?? null) : null;
  const removed = mode.kind === "edit" && view !== null && editing === null; // gone meanwhile
  useFitBelow(panel, open, mode.kind);

  // the models arrive after the panel opens (the first time, the list is only "Loading…"): once
  // they are there, focus goes to the active model (or the tab stop; "Try again" when they
  // couldn't load), unless it was moved meanwhile
  useEffect(() => {
    if (!open || !opening.current || mode.kind !== "list" || (status !== "ready" && status !== "error")) return;
    opening.current = false;
    const at = document.activeElement;
    if (at && at !== document.body && at !== button.current) return;
    focusIn(panel, ACTIVE_ITEM, TAB_STOP_ITEM, ".ai-menu-list button", "button");
  }, [open, status, mode.kind]);

  // the provider being edited was removed (another tab): its form is gone, the notice takes focus
  useEffect(() => {
    if (removed) focusIn(panel, ".ai-model-removed");
  }, [removed]);

  const close = (refocus = true) => {
    setOpen(false);
    setMode({ kind: "list" });
    if (refocus) button.current?.focus({ preventScroll: true });
  };

  // a click outside closes it; so does Escape wherever focus is, unless the form took it first
  useEffect(() => {
    if (!open) return;
    const shut = () => {
      setOpen(false);
      setMode({ kind: "list" });
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) shut();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      shut();
      button.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (open) return close();
    setMode({ kind: "list" });
    setOpen(true);
    opening.current = true;
    models.load();
  };

  const showList = (focus: string) => {
    setMode({ kind: "list" });
    focusIn(panel, focus);
  };

  if (!info.operator) {
    return (
      <button type="button" disabled className="ai-btn ai-model-btn" title="Choosing the model needs the operator role" aria-label={`Model: ${label} (changing it needs the operator role)`}>
        <Cpu className="size-4" aria-hidden />
        <span className="ai-dot" data-tone={tone} aria-hidden />
        <span className="ai-btn-label ai-model-label">{label}</span>
      </button>
    );
  }

  const full = (view?.providers.length ?? 0) >= MAX_PROVIDERS;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        aria-label={`Model: ${label}`}
        title={modelTitle(model)}
        className="ai-btn ai-model-btn"
      >
        <Cpu className="size-4" aria-hidden />
        <span className="ai-dot" data-tone={tone} aria-hidden />
        <span className="ai-btn-label ai-model-label">{label}</span>
        <ChevronDown className="ai-btn-chevron size-3.5 opacity-70" aria-hidden />
      </button>
      {open && (
        <div ref={panel} id={id} role="dialog" aria-label="Models" className="ai-menu ai-model-panel">
          <div className="ai-menu-head">
            <p className="ai-menu-heading">{mode.kind === "add" ? "Add a model" : editing ? `Edit ${editing.name}` : "Model"}</p>
            <IconButton label="Close the model menu" onClick={() => close()} className="size-7">
              <X aria-hidden />
            </IconButton>
          </div>
          {view && (mode.kind === "add" || editing) ? (
            <ModelForm
              key={editing ? editing.id : "add"}
              view={view}
              editing={editing}
              saving={models.pending === "save"}
              onSave={(save) => (save.kind === "add" ? models.add(save.body) : models.update(save.id, save.body))}
              onDone={() => showList(editing ? `[data-edit="${editing.id}"]` : ".ai-model-add")}
            />
          ) : (
            <>
              {removed && (
                <p className="ai-model-reason ai-model-removed" role="alert" tabIndex={-1}>
                  That provider was removed meanwhile (in another tab or window), so nothing was saved.
                </p>
              )}
              <ModelList
                models={models}
                onEdit={(providerId) => {
                  setMode({ kind: "edit", id: providerId });
                  focusIn(panel, "select, input");
                }}
              />
              <div className="ai-menu-foot">
                <span>API keys stay encrypted on this computer</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode({ kind: "add" });
                    focusIn(panel, "select, input");
                  }}
                  disabled={!view || full}
                  title={full ? `At most ${MAX_PROVIDERS} providers can be saved. Remove one first.` : undefined}
                  className="ai-btn ai-btn-small ai-btn-outline ai-model-add"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add model
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
