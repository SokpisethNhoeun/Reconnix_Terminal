"use client";

/* The composer's model chip, bottom left in the message box: `● <model> ▾` with a green dot
   while a model answers (its provider in the tooltip and the accessible name), `● Choose a
   model ▾` with an amber dot while none can (the reason in the tooltip; the label carries the
   state, never the colour alone). It opens the model picker above the composer
   (model-picker.tsx), whose data it keeps between opens (use-models.ts) and reloads on each.
   Operators only: a viewer sees it disabled, with the reason. It stays usable while the message
   box is disabled for want of a model: it is how one is chosen. */
import { useCallback, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { useAssistant } from "./assistant-provider";
import { chipState, VIEWER_REASON } from "./model-picker-rules";
import { ModelPicker } from "./model-picker";
import { useModels } from "./use-models";

export function ModelChip() {
  const { info, setModel } = useAssistant();
  const models = useModels(info.operator, setModel);
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const id = useId();
  const state = chipState(info.model, info.operator);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) chip.current?.focus({ preventScroll: true });
  }, []);

  const content = (
    <>
      <span className="ai-dot" data-tone={state.tone} aria-hidden />
      <span className="ai-model-chip-label">{state.label}</span>
      <ChevronDown className="ai-model-chip-caret" aria-hidden />
    </>
  );

  if (!info.operator) {
    return (
      <>
        <button type="button" disabled aria-label={state.name} aria-describedby={`${id}-why`} title={VIEWER_REASON} data-tone={state.tone} className="ai-model-chip">
          {content}
        </button>
        <span id={`${id}-why`} className="sr-only">
          {VIEWER_REASON}
        </span>
      </>
    );
  }

  return (
    <>
      <button
        ref={chip}
        type="button"
        onClick={() => {
          if (open) return close(true);
          setOpen(true);
          models.load();
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={state.name}
        title={state.title}
        data-tone={state.tone}
        className="ai-model-chip"
      >
        {content}
      </button>
      {open && <ModelPicker id={id} models={models} chip={chip} onClose={close} />}
    </>
  );
}
