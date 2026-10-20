/* The AI model the assistant asks (server only): any OpenAI-compatible endpoint, the same
   convention as the product docs' "Model switching". LLM_BASE_URL and LLM_MODEL pick it;
   LLM_API_KEY is an optional bearer key that never leaves the server. An endpoint off this
   machine receives assessment data, so it also needs LLM_ALLOW_REMOTE=1. "local" means a
   loopback address: a local proxy may still forward elsewhere (the page says "local endpoint"). */
import "server-only";

export interface ModelConfig {
  baseUrl: string; // ends without a slash, e.g. http://127.0.0.1:11434/v1
  model: string;
  apiKey: string | null;
  local: boolean; // on this machine: assessment data stays here
}

export type ModelSetup = { ok: true; config: ModelConfig } | { ok: false; reason: string };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const SETUP = "Set LLM_BASE_URL and LLM_MODEL (for a local Ollama: http://127.0.0.1:11434/v1 and llama3.2) in web/.env.local, then restart /web.";

export function modelSetup(env: Record<string, string | undefined> = process.env): ModelSetup {
  const base = env.LLM_BASE_URL?.trim();
  const model = env.LLM_MODEL?.trim();
  if (!base || !model) return { ok: false, reason: `No AI model is set up. ${SETUP}` };
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return { ok: false, reason: "LLM_BASE_URL is not a valid address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "LLM_BASE_URL must start with http:// or https://." };
  if (url.username || url.password) return { ok: false, reason: "Put the key in LLM_API_KEY, not in LLM_BASE_URL." };
  const local = LOOPBACK.has(url.hostname);
  if (!local && env.LLM_ALLOW_REMOTE?.trim() !== "1") {
    return { ok: false, reason: "LLM_BASE_URL is not on this machine: assessment data would be sent there. Set LLM_ALLOW_REMOTE=1 to allow that." };
  }
  const apiKey = env.LLM_API_KEY?.trim() || null;
  if (apiKey && !local && url.protocol !== "https:") return { ok: false, reason: "LLM_API_KEY is only sent over https to a remote model." };
  if (!/^[\w.:/@+-]{1,128}$/.test(model)) return { ok: false, reason: "LLM_MODEL holds characters a model name doesn't use." };
  url.search = "";
  url.hash = "";
  return { ok: true, config: { baseUrl: url.toString().replace(/\/+$/, ""), model, apiKey, local } };
}

/** What the page may tell the browser: the model's name and whether it runs here. */
export function modelSummary(): { configured: boolean; model: string; local: boolean; reason: string } {
  const setup = modelSetup();
  return setup.ok
    ? { configured: true, model: setup.config.model, local: setup.config.local, reason: "" }
    : { configured: false, model: "", local: false, reason: setup.reason };
}
