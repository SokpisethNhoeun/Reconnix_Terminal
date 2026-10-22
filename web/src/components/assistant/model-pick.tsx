"use client";

/* The model picker's step 1, "Choose a model": Your models (switch in one click) over Add or
   change a provider (go on to its credentials). The first time it opens the models are still on
   their way ("Loading the models…"); once they are there, focus goes to the step's first
   control: the model that answers next (the list's tab stop), or, coming back from step 2, the
   provider row it came from. */
import { useEffect, useRef } from "react";
import { Loader } from "lucide-react";

import { ProviderList } from "./model-providers";
import type { ProviderRow } from "./model-picker-rules";
import type { Models } from "./use-models";
import { YourModels } from "./model-your-models";

interface Props {
  models: Models;
  returnTo: string | null; // the provider row to focus (back from step 2)
  onChosen: () => void;
  onProvider: (row: ProviderRow) => void;
}

export function ModelPick({ models, returnTo, onChosen, onProvider }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const { view, status, error } = models.state;
  const ready = view !== null || status === "error";

  useEffect(() => {
    if (focused.current || !ready) return;
    focused.current = true;
    const at = (selector: string) => root.current?.querySelector<HTMLElement>(selector);
    const el = (returnTo && at(`[data-rove="row:${returnTo}"]`)) || at('[data-rove][tabindex="0"]') || at("button");
    el?.focus({ preventScroll: true });
  }, [ready, returnTo]);

  return (
    <div ref={root} className="ai-picker-body" aria-busy={models.pending !== null}>
      {view ? (
        <>
          {status === "error" && (
            <p className="ai-error-text ai-picker-error" role="alert">
              {error}
            </p>
          )}
          <YourModels view={view} models={models} onChosen={onChosen} />
          <ProviderList view={view} models={models} onPick={onProvider} />
        </>
      ) : status === "error" ? (
        <div className="ai-menu-state" role="alert">
          <p>Couldn&apos;t load the models: {error}</p>
          <button type="button" onClick={models.load} className="ai-btn ai-btn-small ai-btn-outline mt-2">
            Try again
          </button>
        </div>
      ) : (
        <p className="ai-menu-state" role="status">
          <Loader className="mr-1.5 inline size-3.5 animate-spin" aria-hidden /> Loading the models…
        </p>
      )}
    </div>
  );
}
