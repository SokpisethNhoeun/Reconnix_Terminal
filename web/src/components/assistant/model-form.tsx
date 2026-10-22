"use client";

/* + Add model, or editing a saved provider, inside the Model menu: a preset (it fills in the
   base URL), a name, the OpenAI-compatible base URL, an API key (a password field, never filled
   in: editing, it says a key is saved, an empty field keeps it, and it can be removed), the
   model names (model-names.tsx, with Fetch models; a name typed but not added yet is saved
   too, or stops the save when it can't be one), Test connection and Save. The server checks
   everything again; what it refuses stays in the form, said under it. Escape closes the form
   (the menu stays open). A test or a fetch of a saved provider whose address and key are as
   saved asks by its id, so the saved key goes only to its saved address; anything changed is
   tested as typed, with only the key typed here. */
import { useId, useState } from "react";
import { Loader, PlugZap, RefreshCw } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import * as api from "@/lib/assistant/client";
import { type PresetId, PRESETS, presetOf } from "@/lib/assistant/models/presets";
import type { AddProvider, Probe, UpdateProvider } from "@/lib/assistant/models/requests";
import { MAX_NAME, MAX_URL } from "@/lib/assistant/models/schema";
import type { ModelsView, ProviderView } from "@/lib/assistant/models/view";
import { namesToSave } from "./model-name-rules";
import { ModelNames } from "./model-names";

export type SaveModels = { kind: "add"; body: AddProvider } | { kind: "update"; id: string; body: UpdateProvider };

interface Props {
  view: ModelsView;
  editing: ProviderView | null; // null: a new provider
  saving: boolean;
  onSave: (save: SaveModels) => Promise<string | null>;
  onDone: () => void;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
/** Whether a typed address is off this machine (for the hint; the server decides). */
const isRemote = (url: string) => {
  try {
    return !LOOPBACK.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

export function ModelForm({ view, editing, saving, onSave, onDone }: Props) {
  const id = useId();
  const ids = { preset: `${id}-preset`, name: `${id}-name`, url: `${id}-url`, key: `${id}-key`, keyHint: `${id}-key-hint`, urlHint: `${id}-url-hint` };
  const [preset, setPreset] = useState<PresetId>(editing?.preset ?? "ollama");
  const [name, setName] = useState(editing?.name ?? presetOf("ollama").label);
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? presetOf("ollama").baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [models, setModels] = useState<string[]>(editing?.models ?? []);
  const [typedName, setTypedName] = useState(""); // a model name typed but not added yet
  const [activate, setActivate] = useState(true);
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [probing, setProbing] = useState<"test" | "fetch" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keySaved = Boolean(editing?.keySaved) && !removeKey;
  const typedKey = apiKey.trim();
  const remote = isRemote(baseUrl.trim());
  const needsKey = presetOf(preset).key === "required" && !keySaved && !typedKey;

  const choosePreset = (next: PresetId) => {
    const before = presetOf(preset);
    const after = presetOf(next);
    if (!baseUrl.trim() || baseUrl.trim() === before.baseUrl) setBaseUrl(after.baseUrl);
    if (!name.trim() || name.trim() === before.label) setName(after.label);
    setPreset(next);
    setFetched(null);
    setResult(null);
  };

  /** What a test or a fetch asks: the saved provider by its id while its address and key are as
      saved, else the values typed here (with only the key typed here). */
  const probe = (model?: string): Probe =>
    editing && baseUrl.trim() === editing.baseUrl && !typedKey && !removeKey
      ? { providerId: editing.id, ...(model ? { model } : {}) }
      : { baseUrl: baseUrl.trim(), ...(model ? { model } : {}), ...(typedKey ? { apiKey: typedKey } : {}) };

  const test = async () => {
    const names = namesToSave(models, typedName); // a name still in the field counts
    if (!names.ok) return setResult({ ok: false, detail: names.problem });
    if (!names.names.length) return setResult({ ok: false, detail: "Add a model name to test first." });
    setProbing("test");
    setResult(null);
    const answer = await api.testModel(probe(names.names[0]));
    setProbing(null);
    setResult(answer.ok ? answer.result : { ok: false, detail: answer.detail });
  };
  const fetchList = async () => {
    setProbing("fetch");
    setResult(null);
    const answer = await api.fetchModelNames(probe());
    setProbing(null);
    if (answer.ok) setFetched(answer.models);
    else setResult({ ok: false, detail: answer.detail });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the provider a name.");
    if (!baseUrl.trim()) return setError("Give the base URL (it usually ends in /v1).");
    // a name typed without Enter or Add is saved too (shown in the list first), never dropped
    const names = namesToSave(models, typedName);
    if (!names.ok) return setError(names.problem);
    if (!names.names.length) return setError("Add at least one model name.");
    if (names.names.length !== models.length) {
      setModels(names.names);
      setTypedName("");
    }
    const common = { name: name.trim(), preset, baseUrl: baseUrl.trim(), models: names.names, ...(typedKey ? { apiKey: typedKey } : {}) };
    const problem = editing
      ? await onSave({ kind: "update", id: editing.id, body: { ...common, ...(removeKey && !typedKey ? { removeKey: true as const } : {}) } })
      : await onSave({ kind: "add", body: { ...common, activate } });
    if (problem) setError(problem);
    else {
      setApiKey("");
      onDone();
    }
  };

  const busy = saving || probing !== null;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={editing ? `Edit ${editing.name}` : "Add a model"}
      className="ai-model-form"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault(); // closes the form only; the menu stays open
          onDone();
        }
      }}
    >
      <div className="ai-menu-list ai-model-form-body">
        <div className="ai-field">
          <label htmlFor={ids.preset} className="ai-label">
            Provider
          </label>
          <select id={ids.preset} value={preset} onChange={(e) => choosePreset(e.target.value as PresetId)} className="ai-input ai-select">
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ai-field">
          <label htmlFor={ids.name} className="ai-label">
            Name
          </label>
          <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} autoComplete="off" className="ai-input" />
        </div>
        <div className="ai-field">
          <label htmlFor={ids.url} className="ai-label">
            Base URL
          </label>
          <input
            id={ids.url}
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setResult(null);
            }}
            maxLength={MAX_URL}
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            placeholder="http://127.0.0.1:11434/v1"
            aria-describedby={ids.urlHint}
            className="ai-input ai-mono"
          />
          <p id={ids.urlHint} className="ai-hint" data-tone={remote && !view.allowRemote ? "warning" : undefined}>
            {remote
              ? view.allowRemote
                ? "Off this machine: your questions and the assessment data they need are sent there."
                : "Off this machine: the dashboard uses it only when started with LLM_ALLOW_REMOTE=1."
              : "An OpenAI-compatible address, usually ending in /v1."}
          </p>
        </div>
        <div className="ai-field">
          <label htmlFor={ids.key} className="ai-label">
            API key
          </label>
          <input
            id={ids.key}
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setResult(null);
            }}
            disabled={removeKey}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={keySaved ? "Saved: leave empty to keep it" : presetOf(preset).key === "required" ? "Needed by this provider" : "Optional"}
            aria-describedby={ids.keyHint}
            className="ai-input"
          />
          <p id={ids.keyHint} className="ai-hint" data-tone={needsKey ? "warning" : undefined}>
            {editing?.keySaved
              ? removeKey
                ? "The saved key is removed when you save."
                : "A key is saved (encrypted on this computer, never shown). Type a new one to replace it."
              : needsKey
                ? "This provider needs an API key. It is kept encrypted on this computer and never shown again."
                : remote
                  ? "Sent only over https, kept encrypted on this computer and never shown again."
                  : "Kept encrypted on this computer and never shown again."}
          </p>
          {editing?.keySaved && <Checkbox label="Remove the saved key" checked={removeKey} onChange={(e) => setRemoveKey(e.target.checked)} />}
        </div>

        <ModelNames value={models} onChange={setModels} typed={typedName} onTyped={setTypedName} fetched={fetched} />

        <div className="ai-model-probe">
          <button type="button" onClick={fetchList} disabled={busy || !baseUrl.trim()} className="ai-btn ai-btn-small ai-btn-outline">
            {probing === "fetch" ? <Loader className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
            Fetch models
          </button>
          <button type="button" onClick={test} disabled={busy || !baseUrl.trim()} className="ai-btn ai-btn-small ai-btn-outline">
            {probing === "test" ? <Loader className="size-3.5 animate-spin" aria-hidden /> : <PlugZap className="size-3.5" aria-hidden />}
            Test connection
          </button>
        </div>
        <p className="ai-model-result" role="status" data-tone={result ? (result.ok ? "success" : "danger") : undefined}>
          {probing === "test" ? "Testing…" : probing === "fetch" ? "Asking for the model list…" : (result?.detail ?? "")}
        </p>
        {!editing && <Checkbox label="Use it for the next question" checked={activate} onChange={(e) => setActivate(e.target.checked)} />}
      </div>
      <div className="ai-menu-foot">
        <div className="min-w-0 flex-1">
          {error && (
            <p className="ai-error-text" role="alert">
              {error}
            </p>
          )}
        </div>
        <button type="button" onClick={onDone} className="ai-btn ai-btn-small ai-btn-outline">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="ai-btn ai-btn-small ai-btn-primary">
          {saving && <Loader className="size-3.5 animate-spin" aria-hidden />}
          Save
        </button>
      </div>
    </form>
  );
}
