"use client";

/* The Model menu's data: the saved providers, the Environment model and the active choice,
   read when the menu opens; switching, adding, changing and removing go to the server, whose
   answer (the whole view) replaces what the menu shows and tells the assistant which model
   answers next (setModel), so the header and Ask follow without a reload. One change at a time:
   `pending` names it (a switch: "<providerId>/<model>"). Operators only. */
import { useCallback, useRef, useState } from "react";

import * as api from "@/lib/assistant/client";
import type { AddProvider, UpdateProvider } from "@/lib/assistant/models/requests";
import type { ModelsView } from "@/lib/assistant/models/view";
import type { ModelSummary } from "./types";

export interface ModelsState {
  status: "idle" | "loading" | "ready" | "error";
  view: ModelsView | null;
  error: string | null;
}

/** The key of one model choice (a switch in flight, a radio's identity). */
export const choiceKey = (providerId: string, model: string) => `${providerId}/${model}`;

export function useModels(operator: boolean, setModel: (model: ModelSummary) => void) {
  const [state, setState] = useState<ModelsState>({ status: "idle", view: null, error: null });
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);

  const take = useCallback(
    (view: ModelsView) => {
      setState({ status: "ready", view, error: null });
      setModel(view.summary);
    },
    [setModel],
  );

  const load = useCallback(() => {
    if (!operator) return;
    setState((s) => ({ ...s, status: s.view ? "ready" : "loading", error: null }));
    void api.listModels().then((result) => {
      if (result.ok) take(result.view);
      else setState((s) => ({ ...s, status: "error", error: result.detail }));
    });
  }, [operator, take]);

  /** Runs one change; resolves to null when it worked, or what went wrong. A provider that is
      gone (404: removed in another tab) reloads the list, so the menu stops offering it. */
  const run = useCallback(
    async (label: string, call: () => Promise<api.ModelsAnswer>): Promise<string | null> => {
      if (busy.current) return "Another change is still being saved.";
      busy.current = true;
      setPending(label);
      try {
        const result = await call();
        if (!result.ok) {
          if (result.status === 404) load();
          return result.detail;
        }
        take(result.view);
        return null;
      } finally {
        busy.current = false;
        setPending(null);
      }
    },
    [take, load],
  );

  const choose = useCallback((providerId: string, model: string) => run(choiceKey(providerId, model), () => api.switchModel({ providerId, model })), [run]);
  const add = useCallback((body: AddProvider) => run("save", () => api.addModelProvider(body)), [run]);
  const update = useCallback((id: string, body: UpdateProvider) => run("save", () => api.updateModelProvider(id, body)), [run]);
  const remove = useCallback((id: string) => run(`remove:${id}`, () => api.removeModelProvider(id)), [run]);

  return { state, pending, load, choose, add, update, remove };
}

export type Models = ReturnType<typeof useModels>;
