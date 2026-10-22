"use client";

/* The model picker's step 3, "<Provider> · choose a model": the models Continue found as radio
   buttons (a native group: the arrow keys move and select, nothing is saved until "Use this
   model"), plus "Type a model name" with its field (model-picker-rules.ts checks the name; a
   typed name, or any name when the server gave no list, is tested before it is saved). Use
   this model adds the provider (made active) or changes the saved one and switches to it; the
   picker then closes and the chip, the reason above the composer and Ask follow without a
   reload (use-models.ts). What the server refuses stays here. Back (or Escape) returns to
   step 2 with what was typed there. */
import { useEffect, useId, useRef, useState } from "react";
import { Loader } from "lucide-react";

import * as api from "@/lib/assistant/client";
import type { Preset } from "@/lib/assistant/models/presets";
import type { ModelsView, ProviderView } from "@/lib/assistant/models/view";
import { nameProblem } from "./model-name-rules";
import { type ChooseList, type Credentials, initialChoice, probeOf, providerName, requestsForUse } from "./model-picker-rules";
import type { Models } from "./use-models";

interface Props {
  preset: Preset;
  provider: ProviderView | null;
  view: ModelsView;
  credentials: Credentials;
  list: ChooseList;
  models: Models;
  onBack: () => void;
  onDone: () => void;
}

const TYPED = ""; // the radio value of "Type a model name"

export function ModelChoose({ preset, provider, view, credentials, list, models, onBack, onDone }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const typedField = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [choice, setChoice] = useState<string>(() => initialChoice(list.models, provider, view) ?? TYPED);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = providerName(preset, provider);

  useEffect(() => {
    // the step's first control: the chosen model, or the name field when nothing was listed
    const el = list.models.length ? root.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked') : typedField.current;
    el?.focus({ preventScroll: true });
    alive.current = true;
    return () => {
      alive.current = false; // left (Back, Escape, closed) while saving: the answer is dropped here
    };
  }, [list.models.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const typing = choice === TYPED;
    const problem = typing ? nameProblem(typed) : null;
    if (problem) return setError(problem);
    const model = typing ? typed.trim() : choice;
    const built = requestsForUse(preset, provider, view, credentials, model);
    if (!built.ok) return setError(built.problem);
    setBusy(true);
    setError(null);
    if (typing || list.verify) {
      const tested = await api.testModel(probeOf(preset, provider, credentials, model));
      const failed = !tested.ok ? tested.detail : tested.result.ok ? null : tested.result.detail;
      if (failed) {
        if (alive.current) {
          setBusy(false);
          setError(failed);
        }
        return;
      }
    }
    const refused = await models.save(built.requests);
    if (!alive.current) return;
    setBusy(false);
    if (refused) setError(refused);
    else onDone();
  };

  const pick = (value: string) => {
    setChoice(value);
    setError(null);
  };

  return (
    <form onSubmit={submit} noValidate className="ai-picker-form">
      <div ref={root} className="ai-picker-body ai-picker-fields">
        {list.note && <p className="ai-hint">{list.note}</p>}
        <div role="radiogroup" aria-label={`${name} models`} className="ai-picker-radios">
          {list.models.map((m) => (
            <label key={m} className="ai-picker-radio">
              <input type="radio" name={`${id}-model`} value={m} checked={choice === m} onChange={() => pick(m)} />
              <span className="ai-picker-model-name">{m}</span>
            </label>
          ))}
          <label className="ai-picker-radio">
            <input type="radio" name={`${id}-model`} value={TYPED} checked={choice === TYPED} onChange={() => pick(TYPED)} />
            <span>Type a model name</span>
          </label>
        </div>
        {choice === TYPED && (
          <input
            ref={typedField}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setError(null);
            }}
            maxLength={128}
            spellCheck={false}
            autoComplete="off"
            placeholder="e.g. llama3.2"
            aria-label="Model name"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="ai-input ai-mono"
          />
        )}
        {error && (
          <p id={`${id}-error`} className="ai-picker-refusal" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="ai-picker-foot">
        <button type="button" onClick={onBack} className="ai-btn ai-btn-small ai-btn-outline">
          Back
        </button>
        <button type="submit" disabled={busy} className="ai-btn ai-btn-small ai-btn-primary">
          {busy && <Loader className="size-3.5 animate-spin" aria-hidden />}
          Use this model
        </button>
      </div>
    </form>
  );
}
