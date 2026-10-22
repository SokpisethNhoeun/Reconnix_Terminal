/* The model picker's rules (model-chip.tsx, model-picker.tsx and its three steps), before the
   server checks everything again: what the chip says, the rows of step 1 ("Your models" and
   "Add or change a provider", a cloud row disabled with the reason while the server keeps data
   on this machine), which fields step 2 shows and what Continue asks the fetch and test routes,
   where Continue goes with their answer, and the requests "Use this model" sends (a new
   provider, or a change to the saved one and a switch). A saved key goes only to its saved
   address: anything changed is asked as typed, with only the key typed here. A saved provider's
   state comes from its address, and a cloud preset's name only goes with the cloud's own
   address. Pure: browser and tests. */
import { fitsPreset, type Preset, presetOf, PRESETS } from "@/lib/assistant/models/presets";
import type { AddProvider, Probe, SetActive, UpdateProvider } from "@/lib/assistant/models/requests";
import { API_KEY, ENVIRONMENT, MAX_MODELS, MAX_NAME } from "@/lib/assistant/models/schema";
import type { FetchResult, ModelsView, ProviderView } from "@/lib/assistant/models/view";
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
        provider: savedName(p),
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
  preset: Preset; // what the row is made from (presetFor: a saved provider's)
  provider: ProviderView | null; // the saved provider this row changes (null: a new one)
  label: string;
  state: string; // "key saved", "local", "remote", "cloud" or ""
  disabled: string | null; // why it can't be chosen now
}

/** The preset's name in the list: "Ollama (local)", "Custom (OpenAI-compatible)". */
export const presetLabel = (preset: Preset) => (preset.kind === "local" ? `${preset.label} (local)` : preset.kind === "custom" ? "Custom (OpenAI-compatible)" : preset.label);

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/** The preset a saved provider is shown and changed as: its own, except a cloud preset at
    another address (saved before the server tied the two together), which is Custom: its address
    shows, and a change saves it as Custom. */
export function presetFor(provider: ProviderView): Preset {
  const own = presetOf(provider.preset);
  return fitsPreset(own, provider.baseUrl) ? own : presetOf("custom");
}

/** A saved provider's name, with its real host when it was saved under a cloud preset it doesn't
    fit (the cloud's name never vouches for another address): "OpenAI (llm.example.com)". */
const savedName = (provider: ProviderView) => (presetFor(provider).id === provider.preset ? provider.name : `${provider.name} (${hostOf(provider.baseUrl)})`);

/** A row's state. A saved provider's comes from its address (a local preset's name says nothing
    about where it was saved), a preset's from its kind. */
function stateOf(preset: Preset, provider: ProviderView | null): string {
  if (provider) return provider.keySaved ? "key saved" : provider.local ? "local" : "remote";
  return preset.kind === "cloud" ? "cloud" : preset.kind === "local" ? "local" : "";
}

/** A saved provider's row name: the preset's when it is named after it ("(local)" only while its
    address is), else its own (with the real host, as savedName). */
function savedLabel(preset: Preset, provider: ProviderView): string {
  if (provider.name !== preset.label || provider.preset !== preset.id) return savedName(provider);
  return preset.kind === "local" && !provider.local ? preset.label : presetLabel(preset);
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
    const saved = view.providers.filter((p) => presetFor(p).id === preset.id);
    if (!saved.length) rows.push({ key: preset.id, preset, provider: null, label: presetLabel(preset), state: stateOf(preset, null), disabled });
    for (const p of saved) rows.push({ key: p.id, preset, provider: p, label: savedLabel(preset, p), state: stateOf(preset, p), disabled });
  }
  return rows;
}

/** The provider's name in the steps' titles ("Anthropic · credentials"). */
export const providerName = (preset: Preset, provider: ProviderView | null) => (provider ? savedName(provider) : preset.label);

// --- step 2: credentials -----------------------------------------------------------------------

export interface Credentials {
  baseUrl: string; // as typed (only Custom and the local presets show the field)
  apiKey: string; // as typed: never filled in from a saved key
  removeKey: boolean;
}

/** Only Custom and the local presets take an address; a cloud preset's is fixed. */
export const showsUrl = (preset: Preset) => preset.kind !== "cloud";

/** What the picker keeps of step 2 while it is open: never the key itself (an uncontrolled
    field, read on Continue; the picker holds it for step 3 only), just whether one is typed. */
export interface Fields {
  baseUrl: string;
  removeKey: boolean;
  keyTyped: boolean;
}

/** Step 2's fields as they start: the saved address (or the preset's), no key. */
export const startFields = (preset: Preset, provider: ProviderView | null): Fields => ({ baseUrl: provider?.baseUrl ?? preset.baseUrl, removeKey: false, keyTyped: false });

/** The fields with the key read from its field, as the rules below take them. */
export const withKey = (f: Fields, apiKey: string): Credentials => ({ baseUrl: f.baseUrl, apiKey, removeKey: f.removeKey });

/** Step 2's fields as they start, as the rules take them (no key). */
export const startCredentials = (preset: Preset, provider: ProviderView | null): Credentials => withKey(startFields(preset, provider), "");

/** The address the provider is asked at. */
export const addressOf = (preset: Preset, provider: ProviderView | null, c: Pick<Credentials, "baseUrl">) => (showsUrl(preset) ? c.baseUrl.trim() : (provider?.baseUrl ?? preset.baseUrl));

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
    typing a model name can still go on). Only "not listed" leads to the test or to typing:
    anything else (never reached, a refused key, a limit…) has to be fixed here first. */
export type ContinueNext =
  | { next: "choose"; models: string[]; note: string | null; verify: boolean }
  | { next: "test"; model: string }
  | { next: "stay"; error: string; typeInstead: boolean };
/** Step 3's list: what Continue found. */
export type ChooseList = Extract<ContinueNext, { next: "choose" }>;

const NOT_LISTED = "The server doesn't list its models: these are the ones saved.";
const NONE_LISTED = "The server lists no models: type the model's name.";

/** After the fetch route answered: its list, `listed: false` (the model's server answered, but
    without a list), or a failure. */
export function afterFetch(answer: Answer<FetchResult>, known: readonly string[]): ContinueNext {
  if (!answer.ok) return { next: "stay", error: answer.detail, typeInstead: false };
  if ("models" in answer) return answer.models.length ? { next: "choose", models: answer.models, note: null, verify: false } : { next: "choose", models: [], note: NONE_LISTED, verify: true };
  if (known.length) return { next: "test", model: known[0] };
  return { next: "stay", error: answer.detail, typeInstead: true };
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
    only the switch) and the switch. A provider shown under another preset than it was saved
    with (a cloud one at another address: presetFor) is saved as that preset, Custom. */
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
    ...(preset.id !== provider.preset ? { preset: preset.id } : {}),
    ...(baseUrl !== provider.baseUrl ? { baseUrl } : {}),
    ...(added ? { models: [...provider.models, model] } : {}),
    ...(key ? { apiKey: key } : c.removeKey && provider.keySaved ? { removeKey: true as const } : {}),
  };
  return { ok: true, requests: { kind: "update", id: provider.id, body: Object.keys(body).length ? body : null, activate: { providerId: provider.id, model } } };
}
