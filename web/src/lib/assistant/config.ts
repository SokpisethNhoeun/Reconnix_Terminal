/* The rules for the AI model the assistant asks (server only): any OpenAI-compatible endpoint,
   the same convention as the product docs' "Model switching". `checkModel` holds the rules every
   model passes, wherever it comes from (the environment, or one saved in the Model menu:
   models/resolve.ts): http(s) only, no credentials in the address, a model name of the usual
   characters, an API key only over https to a remote host, and an address off this machine
   only when the server runs with LLM_ALLOW_REMOTE=1 (the browser can't turn that on). An
   endpoint off this machine receives assessment data. "local" means a loopback address: a
   local proxy may still forward elsewhere (the page says "local endpoint").

   `modelSetup` reads the environment's model: LLM_BASE_URL and LLM_MODEL pick it; LLM_API_KEY
   is an optional bearer key that never leaves the server. */
import "server-only";

import { MAX_URL, MODEL_NAME } from "./models/schema";

export interface ModelConfig {
  baseUrl: string; // ends without a slash, e.g. http://127.0.0.1:11434/v1
  model: string;
  apiKey: string | null;
  local: boolean; // on this machine: assessment data stays here
}

export type ModelSetup = { ok: true; config: ModelConfig } | { ok: false; reason: string };

/** How the reasons name the address, the key and the model. */
export interface Wording {
  url: string; // at the start of a sentence
  urlIn: string; // inside one
  key: string; // where the key goes
  keyStart: string; // the key, at the start of a sentence
  model: string;
  allow: string; // how remote models are allowed
}

/** The environment's words (web/.env.local). */
export const ENV_WORDING: Wording = {
  url: "LLM_BASE_URL",
  urlIn: "LLM_BASE_URL",
  key: "LLM_API_KEY",
  keyStart: "LLM_API_KEY",
  model: "LLM_MODEL",
  allow: "Set LLM_ALLOW_REMOTE=1 to allow that.",
};

/** The Model menu's words. */
export const FORM_WORDING: Wording = {
  url: "The base URL",
  urlIn: "the base URL",
  key: "the API key field",
  keyStart: "An API key",
  model: "The model name",
  allow: "The dashboard allows that only when it was started with LLM_ALLOW_REMOTE=1.",
};

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const SETUP = "Set LLM_BASE_URL and LLM_MODEL (for a local Ollama: http://127.0.0.1:11434/v1 and llama3.2) in web/.env.local, then restart /web.";

export interface ModelInput {
  baseUrl: string;
  model: string;
  apiKey: string | null;
}

/** The address alone (no model name yet): the rules, then the address without its query, hash
    and trailing slashes, at most MAX_URL characters as written out. */
export function checkAddress(
  input: Omit<ModelInput, "model">,
  { allowRemote, words = FORM_WORDING }: { allowRemote: boolean; words?: Wording },
): { ok: true; baseUrl: string; local: boolean } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(input.baseUrl);
  } catch {
    return { ok: false, reason: `${words.url} is not a valid address.` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: `${words.url} must start with http:// or https://.` };
  if (url.username || url.password) return { ok: false, reason: `Put the key in ${words.key}, not in ${words.urlIn}.` };
  const local = LOOPBACK.has(url.hostname);
  if (!local && !allowRemote) {
    return { ok: false, reason: `${words.url} is not on this machine: assessment data would be sent there. ${words.allow}` };
  }
  if (input.apiKey && !local && url.protocol !== "https:") return { ok: false, reason: `${words.keyStart} is only sent over https to a remote model.` };
  url.search = "";
  url.hash = "";
  const baseUrl = url.toString().replace(/\/+$/, "");
  // written out in full (%-encoded), an address can outgrow what was typed: checked as it is kept
  if (baseUrl.length > MAX_URL) return { ok: false, reason: `${words.url} is too long once its special characters are encoded: at most ${MAX_URL} characters.` };
  return { ok: true, baseUrl, local };
}

/** A model, wherever it comes from, against the rules above. */
export function checkModel(input: ModelInput, options: { allowRemote: boolean; words?: Wording }): ModelSetup {
  const address = checkAddress(input, options);
  if (!address.ok) return address;
  if (!MODEL_NAME.test(input.model)) return { ok: false, reason: `${(options.words ?? FORM_WORDING).model} holds characters a model name doesn't use.` };
  return { ok: true, config: { baseUrl: address.baseUrl, model: input.model, apiKey: input.apiKey, local: address.local } };
}

/** Whether an address is on this machine (false for anything that isn't an address). */
export function isLocal(baseUrl: string): boolean {
  try {
    return LOOPBACK.has(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

/** Whether this server may send data to a model off this machine (LLM_ALLOW_REMOTE=1). */
export const remoteAllowed = (env: Record<string, string | undefined> = process.env) => env.LLM_ALLOW_REMOTE?.trim() === "1";

/** The environment's model (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_ALLOW_REMOTE). */
export function modelSetup(env: Record<string, string | undefined> = process.env): ModelSetup {
  const base = env.LLM_BASE_URL?.trim();
  const model = env.LLM_MODEL?.trim();
  if (!base || !model) return { ok: false, reason: `No AI model is set up. ${SETUP}` };
  return checkModel({ baseUrl: base, model, apiKey: env.LLM_API_KEY?.trim() || null }, { allowRemote: remoteAllowed(env), words: ENV_WORDING });
}
