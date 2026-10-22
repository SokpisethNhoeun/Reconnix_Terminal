"use client";

/* The model picker's step 2, "<Provider> · credentials": the base URL (Custom, Ollama and LM
   Studio only, filled in with the saved address or the preset's) and the API key (a password
   field, never filled in; with a key saved, "Key saved: leave empty to keep it" and Remove key).
   Continue asks the fetch route for the provider's models (a saved provider as saved, by its id;
   anything changed as typed, with only the key typed here) and, when its server answers without
   a list, tests a model it is known to have; then step 3. What the server refuses (its fixed
   words: an address off this machine, a bad URL, a key over http…) stays here, in the error
   style; when the model's server only failed to list its models, "Type a model name instead"
   goes on without the list. Back (or Escape) returns to step 1. */
import { useEffect, useId, useRef, useState } from "react";
import { Loader } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import * as api from "@/lib/assistant/client";
import type { Preset } from "@/lib/assistant/models/presets";
import { MAX_URL } from "@/lib/assistant/models/schema";
import type { ModelsView, ProviderView } from "@/lib/assistant/models/view";
import {
  addressOf,
  afterFetch,
  afterTest,
  type ChooseList,
  type Credentials,
  credentialsProblem,
  probeOf,
  providerName,
  showsUrl,
  typeInstead,
} from "./model-picker-rules";

interface Props {
  preset: Preset;
  provider: ProviderView | null;
  view: ModelsView;
  value: Credentials;
  onChange: (value: Credentials) => void;
  onBack: () => void;
  onNext: (list: ChooseList) => void;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

export function ModelCredentials({ preset, provider, view, value, onChange, onBack, onNext }: Props) {
  const id = useId();
  const ids = { url: `${id}-url`, urlHint: `${id}-url-hint`, key: `${id}-key`, keyHint: `${id}-key-hint` };
  const first = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; typeInstead: boolean } | null>(null);
  const name = providerName(preset, provider);
  const host = hostOf(addressOf(preset, provider, value));
  const remote = host !== null && !LOOPBACK.has(host);
  const keySaved = Boolean(provider?.keySaved);

  useEffect(() => {
    first.current?.focus({ preventScroll: true });
    alive.current = true;
    return () => {
      alive.current = false; // left (Back, Escape, closed) while asking: the answer is dropped
    };
  }, []);

  const set = (change: Partial<Credentials>) => {
    onChange({ ...value, ...change });
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = credentialsProblem(preset, provider, value);
    if (problem) return setError({ text: problem, typeInstead: false });
    setBusy(true);
    setError(null);
    const known = provider?.models ?? [];
    let next = afterFetch(await api.fetchModelNames(probeOf(preset, provider, value)), known);
    if (next.next === "test") next = afterTest(await api.testModel(probeOf(preset, provider, value, next.model)), known);
    if (!alive.current) return;
    setBusy(false);
    if (next.next === "choose") onNext(next);
    else if (next.next === "stay") setError({ text: next.error, typeInstead: next.typeInstead });
  };

  return (
    <form onSubmit={submit} noValidate className="ai-picker-form">
      <div className="ai-picker-body ai-picker-fields">
        {showsUrl(preset) ? (
          <div className="ai-field">
            <label htmlFor={ids.url} className="ai-label">
              Base URL
            </label>
            <input
              ref={first}
              id={ids.url}
              value={value.baseUrl}
              onChange={(e) => set({ baseUrl: e.target.value })}
              maxLength={MAX_URL}
              inputMode="url"
              spellCheck={false}
              autoComplete="off"
              placeholder="http://127.0.0.1:8000/v1"
              aria-describedby={ids.urlHint}
              className="ai-input ai-mono"
            />
            <p id={ids.urlHint} className="ai-hint" data-tone={remote && !view.allowRemote ? "warning" : undefined}>
              {!remote
                ? "An OpenAI-compatible address, usually ending in /v1."
                : view.allowRemote
                  ? "Off this machine: your questions, the assessment data they need and relevant /add-on knowledge passages are sent there."
                  : "Off this machine: the dashboard uses it only when started with LLM_ALLOW_REMOTE=1."}
            </p>
          </div>
        ) : (
          <p className="ai-hint">
            {name} runs at {host}: your questions, the assessment data they need and relevant /add-on knowledge passages are sent there.
          </p>
        )}
        <div className="ai-field">
          <label htmlFor={ids.key} className="ai-label">
            API key
          </label>
          <input
            ref={showsUrl(preset) ? undefined : first}
            id={ids.key}
            type="password"
            value={value.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={keySaved && !value.removeKey ? "Key saved" : preset.key === "required" ? `Needed by ${name}` : "Optional"}
            aria-describedby={ids.keyHint}
            className="ai-input"
          />
          <p id={ids.keyHint} className="ai-hint">
            {keySaved
              ? value.removeKey
                ? "The saved key is removed when you use a model (a key typed here replaces it)."
                : "Key saved: leave empty to keep it"
              : `${preset.key === "required" ? "Needed." : "Optional."} Kept encrypted on this computer and never shown again.`}
          </p>
          {keySaved && <Checkbox label="Remove key" checked={value.removeKey} onChange={(e) => set({ removeKey: e.target.checked })} />}
        </div>
        {error && (
          <div className="ai-picker-refusal" role="alert">
            <p>{error.text}</p>
            {error.typeInstead && (
              <button type="button" onClick={() => onNext(typeInstead())} className="ai-btn ai-btn-small ai-btn-outline mt-2">
                Type a model name instead
              </button>
            )}
          </div>
        )}
      </div>
      <div className="ai-picker-foot">
        <button type="button" onClick={onBack} className="ai-btn ai-btn-small ai-btn-outline">
          Back
        </button>
        <button type="submit" disabled={busy} className="ai-btn ai-btn-small ai-btn-primary">
          {busy && <Loader className="size-3.5 animate-spin" aria-hidden />}
          Continue
        </button>
      </div>
    </form>
  );
}
