/* Which model answers (server only). A model chosen in the Model menu (models.json's active
   provider and model) wins, checked again on every use by config.ts's rules with this server's
   LLM_ALLOW_REMOTE: if it can't be used any more, the reason is reported and nothing else
   answers in its place. With nothing chosen, the Environment's model (LLM_BASE_URL / LLM_MODEL
   in web/.env.local) answers, as before the menu existed. Also what the Model menu's routes
   answer (`modelsView`) and the model a test or a fetch talks to (`probeTarget`): a saved key
   only ever goes to its provider's saved address. */
import "server-only";

import { checkAddress, checkModel, isLocal, type ModelConfig, modelSetup, remoteAllowed } from "../config";
import { MODELS_FAIL, ModelsError } from "./errors";
import type { Probe } from "./requests";
import { readSaved, type Saved, viewOf } from "./store";
import { ENVIRONMENT, ENVIRONMENT_NAME } from "./schema";
import type { ActiveView, EnvironmentView, ModelsView, ModelSummary } from "./view";

type Env = Record<string, string | undefined>;

export type ActiveModel = { ok: true; config: ModelConfig; summary: ModelSummary } | { ok: false; reason: string; summary: ModelSummary };

export const NO_MODEL =
  "No AI model is set up. Add one with + Add model in the assistant's Model menu, or set LLM_BASE_URL and LLM_MODEL (for a local Ollama: http://127.0.0.1:11434/v1 and llama3.2) in web/.env.local and restart /web.";

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The Environment's model name and address as typed (trimmed), or null when either is unset. */
function envModel(env: Env): { base: string; model: string } | null {
  const base = env.LLM_BASE_URL?.trim();
  const model = env.LLM_MODEL?.trim();
  return base && model ? { base, model } : null;
}

const refused = (reason: string, name = "", provider = "", local = false): ActiveModel => ({
  ok: false,
  reason,
  summary: { configured: false, name: cut(name, 128), provider: cut(provider, 60), local, reason: cut(reason, 600) },
});

function resolveFrom(saved: Saved, env: Env): ActiveModel {
  const active = saved.file.active;
  if (active) {
    const p = saved.file.providers.find((x) => x.id === active.providerId)!; // store.ts checked it is there
    let apiKey: string | null;
    try {
      apiKey = saved.apiKeyOf(p);
    } catch (error) {
      return refused(`${p.name}: ${error instanceof ModelsError ? error.message : MODELS_FAIL.sealed}`, active.model, p.name, isLocal(p.baseUrl));
    }
    const checked = checkModel({ baseUrl: p.baseUrl, model: active.model, apiKey }, { allowRemote: remoteAllowed(env) });
    if (!checked.ok) return refused(`${p.name}: ${checked.reason}`, active.model, p.name, isLocal(p.baseUrl));
    return { ok: true, config: checked.config, summary: { configured: true, name: active.model, provider: p.name, local: checked.config.local, reason: "" } };
  }
  const setup = modelSetup(env);
  if (setup.ok) return { ok: true, config: setup.config, summary: { configured: true, name: setup.config.model, provider: ENVIRONMENT_NAME, local: setup.config.local, reason: "" } };
  const typed = envModel(env);
  return typed ? refused(setup.reason, typed.model, ENVIRONMENT_NAME, isLocal(typed.base)) : refused(NO_MODEL);
}

/** The model that answers the next question, or why there is none. Never throws. */
export async function activeModel(env: Env = process.env): Promise<ActiveModel> {
  let saved: Saved;
  try {
    saved = await readSaved();
  } catch (error) {
    return refused(error instanceof ModelsError ? error.message : MODELS_FAIL.read);
  }
  return resolveFrom(saved, env);
}

/** What the Model menu shows: the saved providers (no keys), the Environment, the choice and the
    summary. Throws a ModelsError when the saved models can't be read. */
export async function modelsView(env: Env = process.env): Promise<ModelsView> {
  const saved = await readSaved();
  const typed = envModel(env);
  const setup = modelSetup(env);
  const environment: EnvironmentView | null = typed
    ? { name: ENVIRONMENT_NAME, model: cut(typed.model, 400), local: isLocal(typed.base), reason: setup.ok ? "" : cut(setup.reason, 600) }
    : null;
  const active: ActiveView | null = saved.file.active ?? (typed ? { providerId: ENVIRONMENT, model: cut(typed.model, 400) } : null);
  return {
    providers: saved.file.providers.map(viewOf),
    environment,
    active,
    summary: resolveFrom(saved, env).summary,
    allowRemote: remoteAllowed(env),
  };
}

/** The model a test or a fetch talks to: a saved provider as saved (its key to its own address
    only), the Environment's, or unsaved values (only the key typed with them). `needsModel`:
    a test needs a model name, a fetch doesn't. */
export async function probeTarget(probe: Probe, needsModel: boolean, env: Env = process.env): Promise<ModelConfig> {
  const allowRemote = remoteAllowed(env);
  if ("providerId" in probe) {
    if (probe.providerId === ENVIRONMENT) {
      const setup = modelSetup(env);
      if (!setup.ok) throw new ModelsError(setup.reason, 400);
      return probe.model ? { ...setup.config, model: probe.model } : setup.config;
    }
    const { file, apiKeyOf } = await readSaved();
    const p = file.providers.find((x) => x.id === probe.providerId);
    if (!p) throw new ModelsError("That provider is not saved any more.", 404);
    const model = probe.model ?? p.models[0];
    const checked = checkModel({ baseUrl: p.baseUrl, model, apiKey: apiKeyOf(p) }, { allowRemote });
    if (!checked.ok) throw new ModelsError(checked.reason, 400);
    return checked.config;
  }
  if (needsModel && !probe.model) throw new ModelsError("Name a model to test.", 400);
  const apiKey = probe.apiKey ?? null;
  if (!probe.model) {
    const address = checkAddress({ baseUrl: probe.baseUrl, apiKey }, { allowRemote });
    if (!address.ok) throw new ModelsError(address.reason, 400);
    return { baseUrl: address.baseUrl, model: "", apiKey, local: address.local };
  }
  const checked = checkModel({ baseUrl: probe.baseUrl, model: probe.model, apiKey }, { allowRemote });
  if (!checked.ok) throw new ModelsError(checked.reason, 400);
  return checked.config;
}
