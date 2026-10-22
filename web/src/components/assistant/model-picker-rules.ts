/* The model picker's rules (model-chip.tsx, model-picker.tsx and its three steps), before the
   server checks everything again: what the chip says, the rows of step 1 ("Your models" and
   "Add or change a provider", a cloud row disabled with the reason while the server keeps data
   on this machine), which fields step 2 shows and what Continue asks the fetch and test routes,
   where Continue goes with their answer, and the requests "Use this model" sends (a new
   provider, or a change to the saved one and a switch). A saved key goes only to its saved
   address: anything changed is asked as typed, with only the key typed here. Pure: browser and
   tests. */
import { type Preset, PRESETS } from "@/lib/assistant/models/presets";
import type { AddProvider, Probe, SetActive, UpdateProvider } from "@/lib/assistant/models/requests";
import { API_KEY, ENVIRONMENT, MAX_MODELS, MAX_NAME } from "@/lib/assistant/models/schema";
import type { ModelsView, ProviderView } from "@/lib/assistant/models/view";
import type { ModelSummary } from "./types";

export const CLOUD_OFF = "Start the dashboard with LLM_ALLOW_REMOTE=1 to use cloud models";
export const VIEWER_REASON = "Choosing a model needs the operator role";
export const NO_CHOICE = "Choose a model";

// --- the chip ------------------------------------------------------------------------------------

export interface ChipState {
  label: string; // what it shows: the model's name, or "Choose a model"
  name: string; // its accessible name (with the provider)
  title: string; // its tooltip
  tone: "success" | "warning"; // the dot: a model answers, or none can
}

/** What the composer's model chip says about the model that answers next. */
export function chipState(model: ModelSummary, operator: boolean): ChipState {
  const usable = model.configured && model.name !== "";
  if (!usable) {
    return { label: NO_CHOICE, name: NO_CHOICE, title: operator ? model.reason || "No model answers yet: choose one." : VIEWER_REASON, tone: "warning" };
  }
  const where = model.local ? "local" : "remote";
  const from = model.provider ? `${model.provider}, ${where}` : where;
  const title = !operator
    ? VIEWER_REASON
    : model.local
      ? `${model.name} (${model.provider}): a local endpoint on this machine`
      : `${model.name} (${model.provider}): a remote model. Questions, the assessment data they need and relevant /add-on knowledge passages are sent to it.`;
  return { label: model.name, name: `Model: ${model.name} (${from})`, title, tone: "success" };
}

// --- step 1: your models -----------------------------------------------------------------------

export interface ModelEntry {
  key: string; // "<providerId>/<model>"
  providerId: string;
  model: string;
  provider: string; // the provider's name
  where: string; // "web/.env.local · local", "local", "remote"
  checked: boolean; // answers the next question
  disabled: string | null; // why it can't be chosen now
}

/** "Your models": the Environment's model (read-only, when configured) and every saved model,
    the one that answers next first. */
export function yourModels(view: ModelsView): ModelEntry[] {
  const active = view.active;
  const entries: ModelEntry[] = [];
  const env = view.environment;
  if (env) {
    entries.push({
      key: `${ENVIRONMENT}/${env.model}`,
      providerId: ENVIRONMENT,
      model: env.model,
      provider: env.name,
      where: `web/.env.local · ${env.local ? "local" : "remote"}`,
      checked: active?.providerId === ENVIRONMENT,
      disabled: env.reason || null,
    });
  }
  for (const p of view.providers) {
    for (const model of p.models) {
      entries.push({
        key: `${p.id}/${model}`,
        providerId: p.id,
        model,
        provider: p.name,
        where: p.local ? "local" : "remote",
        checked: active?.providerId === p.id && active.model === model,
        disabled: !p.local && !view.allowRemote ? CLOUD_OFF : null,
      });
    }
  }
  return [...entries.filter((e) => e.checked), ...entries.filter((e) => !e.checked)];
}

// --- step 1: the providers ---------------------------------------------------------------------

export interface ProviderRow {
  key: string; // the saved provider's id, or the preset's
  preset: Preset;
  provider: ProviderView | null; // the saved provider this row changes (null: a new one)
  label: string;
  state: string; // "key saved", "local", "saved", "cloud" or ""
  disabled: string | null; // why it can't be chosen now
}

/** The preset's name in the list: "Ollama (local)", "Custom (OpenAI-compatible)". */
export const presetLabel = (preset: Preset) => (preset.kind === "local" ? `${preset.label} (local)` : preset.kind === "custom" ? "Custom (OpenAI-compatible)" : preset.label);

function stateOf(preset: Preset, provider: ProviderView | null): string {
  if (provider?.keySaved) return "key saved";
  if (preset.kind === "local" || provider?.local) return "local";
  if (provider) return "saved";
  return preset.kind === "cloud" ? "cloud" : "";
}

/** "Add or change a provider": the presets in their order, each the saved provider made from it
    (a provider saved before the picker existed keeps its own row) or the preset itself. A cloud
    preset's address is fixed and off this machine, so its row is disabled, with the reason, while
    the server doesn't allow remote models; a local or custom one never is (its address can be
    changed). */
export function providerRows(view: ModelsView): ProviderRow[] {
  const rows: ProviderRow[] = [];
  for (const preset of PRESETS) {
    const disabled = preset.kind === "cloud" && !view.allowRemote ? CLOUD_OFF : null;
    const saved = view.providers.filter((p) => p.preset === preset.id);
    if (!saved.length) rows.push({ key: preset.id, preset, provider: null, label: presetLabel(preset), state: stateOf(preset, null), disabled });
    for (const p of saved) {
      rows.push({ key: p.id, preset, provider: p, label: p.name === preset.label ? presetLabel(preset) : p.name, state: stateOf(preset, p), disabled });
    }
  }
  return rows;
}

/** The provider's name in the steps' titles ("Anthropic · credentials"). */
export const providerName = (preset: Preset, provider: ProviderView | null) => provider?.name ?? preset.label;

// --- step 2: credentials -----------------------------------------------------------------------

export interface Credentials {
  baseUrl: string; // as typed (only Custom and the local presets show the field)
  apiKey: string; // as typed: never filled in from a saved key
  removeKey: boolean;
}

/** Only Custom and the local presets take an address; a cloud preset's is fixed. */
export const showsUrl = (preset: Preset) => preset.kind !== "cloud";

/** Step 2's fields as they start: the saved address (or the preset's), no key. */
export const startCredentials = (preset: Preset, provider: ProviderView | null): Credentials => ({ baseUrl: provider?.baseUrl ?? preset.baseUrl, apiKey: "", removeKey: false });

/** The address the provider is asked at. */
export const addressOf = (preset: Preset, provider: ProviderView | null, c: Credentials) => (showsUrl(preset) ? c.baseUrl.trim() : (provider?.baseUrl ?? preset.baseUrl));

/** Why Continue can't ask yet, or null (the server checks everything again). */
export function credentialsProblem(preset: Preset, provider: ProviderView | null, c: Credentials): string | null {
  const key = c.apiKey.trim();
  if (showsUrl(preset) && !c.baseUrl.trim()) return "Give the base URL (it usually ends in /v1).";
  if (key && !API_KEY.test(key)) return "An API key is printable characters without spaces.";
  const keyKept = Boolean(provider?.keySaved) && !c.removeKey;
  if (preset.key === "required" && !key && !keyKept) return `${providerName(preset, provider)} needs an API key.`;
  return null;
}

/** What a fetch or a test asks: the saved provider by its id while its address and key are as
    saved (its key goes only to its saved address), else the values here, with only the key
    typed here. */
export function probeOf(preset: Preset, provider: ProviderView | null, c: Credentials, model?: string): Probe {
  const baseUrl = addressOf(preset, provider, c);
  const key = c.apiKey.trim();
  const withModel = model ? { model } : {};
  if (provider && baseUrl === provider.baseUrl && !key && !c.removeKey) return { providerId: provider.id, ...withModel };
  return { baseUrl, ...withModel, ...(key ? { apiKey: key } : {}) };
}

/** A route's answer as the steps read it. */
export type Answer<T> = ({ ok: true } & T) | { ok: false; status: number; detail: string };

/** Where Continue goes: step 3 (with the models to choose from; `verify`: a model chosen there
    is tested before it is saved), a test of a model the provider is known to have, or nowhere
    (the reason stays on step 2; `typeInstead`: the model's server answered without a list, so
    typing a model name can still go on). */
export type ContinueNext =
  | { next: "choose"; models: string[]; note: string | null; verify: boolean }
  | { next: "test"; model: string }
  | { next: "stay"; error: string; typeInstead: boolean };
/** Step 3's list: what Continue found. */
export type ChooseList = Extract<ContinueNext, { next: "choose" }>;

const NOT_LISTED = "The server doesn't list its models: these are the ones saved.";
const NONE_LISTED = "The server lists no models: type the model's name.";

/** After the fetch route answered. 502: the model's server answered, but not with a list. */
export function afterFetch(answer: Answer<{ models: string[] }>, known: readonly string[]): ContinueNext {
  if (answer.ok) return answer.models.length ? { next: "choose", models: answer.models, note: null, verify: false } : { next: "choose", models: [], note: NONE_LISTED, verify: true };
  if (answer.status === 502 && known.length) return { next: "test", model: known[0] };
  return { next: "stay", error: answer.detail, typeInstead: answer.status === 502 };
}

/** After the test route answered for a model the provider is known to have. */
export function afterTest(answer: Answer<{ result: { ok: boolean; detail: string } }>, known: readonly string[]): ContinueNext {
  if (!answer.ok) return { next: "stay", error: answer.detail, typeInstead: false };
  if (!answer.result.ok) return { next: "stay", error: answer.result.detail, typeInstead: true };
  return { next: "choose", models: [...known], note: NOT_LISTED, verify: false };
}

/** "Type a model name" instead (the server gave no list): step 3 with nothing listed. */
export const typeInstead = (): ChooseList =>({ next: "choose", models: [], note: NONE_LISTED, verify: true });

// --- step 3: the model -------------------------------------------------------------------------

/** The model step 3 starts on: the provider's active one, else its first saved one, else the
    first listed; null: "Type a model name". */
export function initialChoice(models: readonly string[], provider: ProviderView | null, view: ModelsView): string | null {
  const active = provider && view.active?.providerId === provider.id ? view.active.model : null;
  for (const name of [active, ...(provider?.models ?? [])]) if (name && models.includes(name)) return name;
  return models[0] ?? null;
}

/** A name no other saved provider has: the preset's, else with a number ("OpenAI 2"). */
export function freeName(label: string, providers: readonly ProviderView[]): string {
  const taken = new Set(providers.map((p) => p.name.toLowerCase()));
  if (!taken.has(label.toLowerCase())) return label;
  for (let n = 2; ; n++) {
    const name = `${label.slice(0, MAX_NAME - 4)} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** What "Use this model" sends: a new provider made active, or the saved one's changes (none:
    only the switch) and the switch. */
export type UseRequests = { kind: "add"; body: AddProvider } | { kind: "update"; id: string; body: UpdateProvider | null; activate: SetActive };

export function requestsForUse(
  preset: Preset,
  provider: ProviderView | null,
  view: ModelsView,
  c: Credentials,
  model: string,
): { ok: true; requests: UseRequests } | { ok: false; problem: string } {
  const baseUrl = addressOf(preset, provider, c);
  const key = c.apiKey.trim();
  if (!provider) {
    const body: AddProvider = { name: freeName(preset.label, view.providers), preset: preset.id, baseUrl, models: [model], ...(key ? { apiKey: key } : {}), activate: true };
    return { ok: true, requests: { kind: "add", body } };
  }
  const added = !provider.models.includes(model);
  if (added && provider.models.length >= MAX_MODELS) return { ok: false, problem: `${provider.name} has ${MAX_MODELS} models saved already: choose one of them.` };
  const body: UpdateProvider = {
    ...(baseUrl !== provider.baseUrl ? { baseUrl } : {}),
    ...(added ? { models: [...provider.models, model] } : {}),
    ...(key ? { apiKey: key } : c.removeKey && provider.keySaved ? { removeKey: true as const } : {}),
  };
  return { ok: true, requests: { kind: "update", id: provider.id, body: Object.keys(body).length ? body : null, activate: { providerId: provider.id, model } } };
}
