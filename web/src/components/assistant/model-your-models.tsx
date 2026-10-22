"use client";

/* The model picker's step 1, "Your models": the Environment's model (web/.env.local, read-only)
   when it is configured and every saved model, the one that answers next first and checked. One
   click, Enter or Space switches to a model and closes the picker; the checked one just closes
   it. A menu of radio items (menuitemradio, aria-checked) with one tab stop (use-roving.ts): the
   arrow keys, Home and End only move focus, since choosing saves. A model that can't be used now
   is disabled, with the reason under the list. */
import { useId, useState } from "react";
import { Check, Loader } from "lucide-react";

import type { ModelsView } from "@/lib/assistant/models/view";
import { type ModelEntry, yourModels } from "./model-picker-rules";
import { useRoving } from "./use-roving";
import { choiceKey, type Models } from "./use-models";

export function YourModels({ view, models, onChosen }: { view: ModelsView; models: Models; onChosen: () => void }) {
  const headingId = useId();
  const reasonId = useId();
  const entries = yourModels(view);
  const roving = useRoving(
    entries.map((e) => e.key),
    entries.find((e) => e.checked)?.key ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  // one note per distinct reason, under the list; each disabled model points at its own
  const reasons = [...new Set(entries.flatMap((e) => (e.disabled ? [e.disabled] : [])))];
  const reasonOf = (e: ModelEntry) => (e.disabled ? `${reasonId}-${reasons.indexOf(e.disabled)}` : undefined);

  const pick = async (e: ModelEntry) => {
    if (e.disabled || models.pending) return;
    if (e.checked) return onChosen();
    setError(null);
    const problem = await models.choose(e.providerId, e.model);
    if (problem) setError(problem);
    else onChosen();
  };

  return (
    <section aria-labelledby={headingId} className="ai-picker-section">
      <h3 id={headingId} className="ai-picker-heading">
        Your models
      </h3>
      {entries.length > 0 ? (
        <div role="menu" aria-labelledby={headingId} aria-orientation="vertical" onKeyDown={roving.onKeyDown} className="ai-picker-list">
          {entries.map((e) => (
            <button
              key={e.key}
              type="button"
              role="menuitemradio"
              aria-checked={e.checked}
              aria-disabled={e.disabled ? true : undefined}
              aria-describedby={reasonOf(e)}
              title={e.disabled ?? (e.checked ? "Answers your next question" : `Use ${e.model}`)}
              onClick={() => void pick(e)}
              className="ai-picker-model"
              {...roving.item(e.key)}
            >
              <span className="ai-picker-check" aria-hidden>
                {models.pending === choiceKey(e.providerId, e.model) ? <Loader className="size-3 animate-spin" /> : e.checked ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="ai-picker-text">
                <span className="ai-picker-model-name">{e.model}</span>{" "}
                <span className="ai-picker-meta">
                  {e.provider} · {e.where}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="ai-picker-empty">No model yet: add a provider below.</p>
      )}
      {reasons.map((reason, i) => (
        <p key={reason} id={`${reasonId}-${i}`} className="ai-picker-off">
          {reason}
        </p>
      ))}
      {error && (
        <p className="ai-error-text ai-picker-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
