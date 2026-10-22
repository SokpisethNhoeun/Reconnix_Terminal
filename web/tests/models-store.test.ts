/* The AI Assistant's saved models (lib/assistant/models/), on a temporary folder
   (RECONIX_ASSISTANT_DIR): the sealed keys (AES-256-GCM: a round trip, a changed byte, another
   key, another provider), the file (owner-only modes, atomic writes, links refused, a corrupt
   file refused with a fixed message, never a key in what the routes get), the rules every saved
   model passes (config.ts) and which model answers (resolve.ts). Never touches ~/.reconix. */
import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkModel, ENV_WORDING, FORM_WORDING, modelSetup } from "@/lib/assistant/config";
import { open, seal } from "@/lib/assistant/models/crypto";
import { MODELS_FAIL, ModelsError } from "@/lib/assistant/models/errors";
import { activeModel, modelsView, NO_MODEL, probeTarget } from "@/lib/assistant/models/resolve";
import { MODELS_FORMAT } from "@/lib/assistant/models/schema";
import { addProvider, listProviders, readSaved, removeProvider, setActive, updateProvider } from "@/lib/assistant/models/store";
import { addQuestion, deleteAllConversations, listConversations } from "@/lib/assistant/history-store";

const SECRET = "sk-test-0123456789abcdefSECRET";
const posix = process.platform !== "win32";
const saved = { ...process.env };
let root = "";
let dir = "";

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "reconix-models-test-"));
  dir = path.join(root, "assistant");
  process.env = { ...saved, RECONIX_ASSISTANT_DIR: dir };
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_ALLOW_REMOTE;
});
afterEach(() => {
  process.env = { ...saved };
  rmSync(root, { recursive: true, force: true });
});

const local = { name: "Local Ollama", preset: "ollama" as const, baseUrl: "http://127.0.0.1:11434/v1/", models: ["llama3.2", "qwen2.5:7b"] };
const remote = { name: "OpenRouter", preset: "openrouter" as const, baseUrl: "https://openrouter.ai/api/v1", models: ["openai/gpt-4o-mini"] };
const modeOf = (p: string) => statSync(p).mode & 0o777;
const fileText = () => readFileSync(path.join(dir, "models.json"), "utf8");

describe("sealed keys", () => {
  const key = randomBytes(32);
  const id = "00000000-0000-4000-8000-000000000001";
  it("open what seal made, with a new IV each time", () => {
    const a = seal(SECRET, key, id);
    const b = seal(SECRET, key, id);
    expect(open(a, key, id)).toBe(SECRET);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toContain(SECRET);
    expect(Buffer.from(a.iv, "base64")).toHaveLength(12);
    expect(Buffer.from(a.tag, "base64")).toHaveLength(16);
  });
  it("refuse a changed byte, a changed tag, another key and another provider", () => {
    const sealed = seal(SECRET, key, id);
    const flip = (b64: string) => {
      const bytes = Buffer.from(b64, "base64");
      bytes[0] ^= 1;
      return bytes.toString("base64");
    };
    expect(() => open({ ...sealed, data: flip(sealed.data) }, key, id)).toThrow(MODELS_FAIL.sealed);
    expect(() => open({ ...sealed, tag: flip(sealed.tag) }, key, id)).toThrow(MODELS_FAIL.sealed);
    expect(() => open({ ...sealed, iv: flip(sealed.iv) }, key, id)).toThrow(MODELS_FAIL.sealed);
    expect(() => open(sealed, randomBytes(32), id)).toThrow(ModelsError);
    expect(() => open(sealed, key, "00000000-0000-4000-8000-000000000002")).toThrow(MODELS_FAIL.sealed);
  });
});

describe("the rules every model passes", () => {
  it("say what is wrong in the form's words", () => {
    const form = (baseUrl: string, model = "m", apiKey: string | null = null, allowRemote = false) => {
      const r = checkModel({ baseUrl, model, apiKey }, { allowRemote, words: FORM_WORDING });
      return r.ok ? "ok" : r.reason;
    };
    expect(form("nope")).toBe("The base URL is not a valid address.");
    expect(form("file:///etc/passwd")).toBe("The base URL must start with http:// or https://.");
    expect(form("https://u:p@llm.example.com/v1", "m", null, true)).toBe("Put the key in the API key field, not in the base URL.");
    expect(form("https://llm.example.com/v1")).toContain("LLM_ALLOW_REMOTE=1");
    expect(form("http://llm.example.com/v1", "m", "k", true)).toBe("An API key is only sent over https to a remote model.");
    expect(form("http://127.0.0.1:1/v1", "a b")).toBe("The model name holds characters a model name doesn't use.");
    expect(form("http://127.0.0.1:1/v1", "m", "k")).toBe("ok"); // a key to this machine over http is fine
  });
  it("are the environment's rules too, with the same results and messages", () => {
    const env = (e: Record<string, string>) => {
      const r = modelSetup(e);
      return r.ok ? r.config : r.reason;
    };
    expect(env({ LLM_BASE_URL: "nope", LLM_MODEL: "m" })).toBe("LLM_BASE_URL is not a valid address.");
    expect(env({ LLM_BASE_URL: "https://u:p@h.example/v1", LLM_MODEL: "m", LLM_ALLOW_REMOTE: "1" })).toBe("Put the key in LLM_API_KEY, not in LLM_BASE_URL.");
    expect(env({ LLM_BASE_URL: "http://127.0.0.1:1/v1", LLM_MODEL: "a b" })).toBe("LLM_MODEL holds characters a model name doesn't use.");
    expect(env({ LLM_BASE_URL: "http://127.0.0.1:1/v1/?x=1#y", LLM_MODEL: "m" })).toEqual({ baseUrl: "http://127.0.0.1:1/v1", model: "m", apiKey: null, local: true });
    expect(ENV_WORDING.url).toBe("LLM_BASE_URL");
  });
});

describe("the saved models", () => {
  it("make the folder 0700, models.json and models.key 0600, and seal the key", async () => {
    await addProvider({ ...local, apiKey: SECRET });
    expect(readdirSync(dir).sort()).toEqual(["models.json", "models.key"]); // no temporary file left
    if (posix) {
      expect(modeOf(dir)).toBe(0o700);
      expect(modeOf(path.join(dir, "models.json"))).toBe(0o600);
      expect(modeOf(path.join(dir, "models.key"))).toBe(0o600);
    }
    expect(statSync(path.join(dir, "models.key")).size).toBe(32);
    const text = fileText();
    expect(text).not.toContain(SECRET);
    expect(JSON.parse(text)).toMatchObject({ format: MODELS_FORMAT, active: null, providers: [{ name: "Local Ollama", baseUrl: "http://127.0.0.1:11434/v1" }] });
    const { file, apiKeyOf } = await readSaved();
    expect(apiKeyOf(file.providers[0])).toBe(SECRET);
  });
  it("never hand a key to what the routes show", async () => {
    await addProvider({ ...local, apiKey: SECRET, activate: true });
    const listed = await listProviders();
    expect(JSON.stringify(listed)).not.toContain(SECRET);
    expect(listed.providers[0]).toMatchObject({ keySaved: true, local: true });
    expect(Object.keys(listed.providers[0]).sort()).toEqual(["baseUrl", "id", "keySaved", "local", "models", "name", "preset"]);
    const view = await modelsView();
    expect(JSON.stringify(view)).not.toContain(SECRET);
  });
  it("write atomically: a change replaces the file, and the old key stays readable", async () => {
    const p = await addProvider({ ...local, apiKey: SECRET });
    const before = lstatSync(path.join(dir, "models.json")).ino;
    await updateProvider(p.id, { name: "Ollama on this machine" });
    expect(lstatSync(path.join(dir, "models.json")).ino).not.toBe(before); // a new file renamed over it
    expect(readdirSync(dir).filter((n) => n.endsWith(".tmp"))).toEqual([]);
    const { file, apiKeyOf } = await readSaved();
    expect(file.providers[0].name).toBe("Ollama on this machine");
    expect(apiKeyOf(file.providers[0])).toBe(SECRET); // no key sent: the saved one stays
  });
  it("refuse a corrupt file with a fixed message, and never replace it", async () => {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(dir, "models.json"), "{ not json", { mode: 0o600 });
    await expect(listProviders()).rejects.toThrow(MODELS_FAIL.read);
    await expect(addProvider(local)).rejects.toThrow(MODELS_FAIL.read);
    expect(fileText()).toBe("{ not json");
    const wrongShape = { format: MODELS_FORMAT, providers: [], active: { providerId: "00000000-0000-4000-8000-000000000001", model: "m" } };
    writeFileSync(path.join(dir, "models.json"), JSON.stringify(wrongShape));
    await expect(listProviders()).rejects.toThrow(MODELS_FAIL.read); // the choice names no saved model
    const resolved = await activeModel({ LLM_BASE_URL: "http://127.0.0.1:1/v1", LLM_MODEL: "env" });
    expect(resolved.ok).toBe(false); // reported, not replaced by the environment's model
    expect(!resolved.ok && resolved.reason).toBe(MODELS_FAIL.read);
  });
  it.runIf(posix)("refuse links: the file, the key and the folder", async () => {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const elsewhere = path.join(root, "elsewhere.json");
    writeFileSync(elsewhere, JSON.stringify({ format: MODELS_FORMAT, providers: [], active: null }));
    symlinkSync(elsewhere, path.join(dir, "models.json"));
    await expect(listProviders()).rejects.toThrow(MODELS_FAIL.read);
    rmSync(path.join(dir, "models.json"));

    const p = await addProvider({ ...local, apiKey: SECRET });
    rmSync(path.join(dir, "models.key"));
    writeFileSync(path.join(root, "other.key"), randomBytes(32));
    symlinkSync(path.join(root, "other.key"), path.join(dir, "models.key"));
    await expect(readSaved()).rejects.toThrow(MODELS_FAIL.key);
    await expect(updateProvider(p.id, { apiKey: "another-key" })).rejects.toThrow(MODELS_FAIL.key);

    rmSync(dir, { recursive: true });
    mkdirSync(path.join(root, "real"), { mode: 0o700 });
    symlinkSync(path.join(root, "real"), dir);
    await expect(addProvider(local)).rejects.toThrow(MODELS_FAIL.plain);
    expect(readdirSync(path.join(root, "real"))).toEqual([]);
  });
  it("leave the conversations alone, and the conversations leave them alone", async () => {
    await addProvider({ ...local, apiKey: SECRET });
    await addQuestion({ scope: { uid: null, label: "All assessments" }, question: "hi" });
    expect(await listConversations()).toHaveLength(1);
    expect(await deleteAllConversations()).toBe(1);
    expect(existsSync(path.join(dir, "models.json"))).toBe(true);
    expect(existsSync(path.join(dir, "models.key"))).toBe(true);
    expect((await listProviders()).providers).toHaveLength(1);
  });

  it("check names: cleaned, unique, never Environment", async () => {
    await addProvider(local);
    await expect(addProvider({ ...local, name: " local OLLAMA " })).rejects.toThrow("saved already");
    await expect(addProvider({ ...local, name: "environment" })).rejects.toThrow("web/.env.local");
    await expect(addProvider({ ...local, name: " ​ " })).rejects.toThrow("Give the provider a name.");
    const p = await addProvider({ ...local, name: "Two\nlines\u0007 here" });
    expect(p.name).toBe("Two lines here");
  });
  it("keep data on this machine unless the server allows remote models", async () => {
    await expect(addProvider({ ...remote, apiKey: SECRET })).rejects.toThrow("LLM_ALLOW_REMOTE=1");
    await expect(addProvider({ ...remote, baseUrl: "http://openrouter.ai/api/v1", apiKey: SECRET }, { LLM_ALLOW_REMOTE: "1" })).rejects.toThrow("only sent over https");
    const p = await addProvider({ ...remote, apiKey: SECRET }, { LLM_ALLOW_REMOTE: "1" });
    expect(p).toMatchObject({ local: false, keySaved: true });
    expect(existsSync(path.join(dir, "models.json")) && fileText()).not.toContain(SECRET);
  });
  it("keep a saved key only while the address stays on its host", async () => {
    const env = { LLM_ALLOW_REMOTE: "1" };
    const p = await addProvider({ ...remote, apiKey: SECRET }, env);
    await expect(updateProvider(p.id, { baseUrl: "https://evil.example/v1" }, env)).rejects.toThrow("enter the API key again");
    expect((await updateProvider(p.id, { baseUrl: "https://openrouter.ai/api/v2" }, env))?.keySaved).toBe(true);
    expect((await updateProvider(p.id, { baseUrl: "https://other.example/v1", apiKey: "new-key" }, env))?.keySaved).toBe(true);
    expect((await updateProvider(p.id, { removeKey: true }, env))?.keySaved).toBe(false);
    const { file, apiKeyOf } = await readSaved();
    expect(apiKeyOf(file.providers[0])).toBeNull();
    expect(await updateProvider("00000000-0000-4000-8000-000000000009", { name: "x" })).toBeNull();
  });
  it("move the active choice with the provider", async () => {
    const p = await addProvider({ ...local, activate: true });
    expect((await listProviders()).active).toEqual({ providerId: p.id, model: "llama3.2" });
    await setActive({ providerId: p.id, model: "qwen2.5:7b" });
    await updateProvider(p.id, { models: ["llama3.2", "phi4"] }); // the active one left the list
    expect((await listProviders()).active).toEqual({ providerId: p.id, model: "llama3.2" });
    await expect(setActive({ providerId: p.id, model: "not-listed" })).rejects.toThrow("not in the provider's list");
    expect(await removeProvider(p.id)).toBe(true);
    expect((await listProviders()).active).toBeNull();
    expect(await removeProvider(p.id)).toBe(false);
  });
});

describe("which model answers", () => {
  const ENV = { LLM_BASE_URL: "http://127.0.0.1:11434/v1", LLM_MODEL: "env-model" };
  it("is the environment's while nothing is chosen, as before", async () => {
    const r = await activeModel(ENV);
    expect(r).toMatchObject({ ok: true, config: { model: "env-model", local: true }, summary: { configured: true, name: "env-model", provider: "Environment" } });
    expect(existsSync(dir)).toBe(false); // reading made no folder
    const none = await activeModel({});
    expect(none).toMatchObject({ ok: false, reason: NO_MODEL, summary: { configured: false, name: "" } });
    expect(NO_MODEL).toContain("Model menu");
  });
  it("is the saved choice when there is one, with its key", async () => {
    const p = await addProvider({ ...local, apiKey: SECRET, activate: true });
    await setActive({ providerId: p.id, model: "qwen2.5:7b" });
    const r = await activeModel(ENV);
    expect(r).toMatchObject({ ok: true, config: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b", apiKey: SECRET }, summary: { provider: "Local Ollama", name: "qwen2.5:7b" } });
    expect(JSON.stringify(r.summary)).not.toContain(SECRET);
    const view = await modelsView(ENV);
    expect(view.active).toEqual({ providerId: p.id, model: "qwen2.5:7b" });
    expect(view.environment).toEqual({ name: "Environment", model: "env-model", local: true, reason: "" });
    await setActive(null);
    expect((await modelsView(ENV)).active).toEqual({ providerId: "environment", model: "env-model" });
  });
  it("says why a saved choice can't be used, instead of asking another model", async () => {
    await addProvider({ ...remote, apiKey: SECRET, activate: true }, { LLM_ALLOW_REMOTE: "1" });
    const r = await activeModel(ENV); // the server no longer allows remote models
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/^OpenRouter: The base URL is not on this machine/);
    expect(r.summary).toMatchObject({ configured: false, name: "openai/gpt-4o-mini", provider: "OpenRouter", local: false });
    rmSync(path.join(dir, "models.key")); // the key can't be opened any more
    const lost = await activeModel({ ...ENV, LLM_ALLOW_REMOTE: "1" });
    expect(!lost.ok && lost.reason).toBe(`OpenRouter: ${MODELS_FAIL.sealed}`);
  });
  it("sends a saved key only to its saved address when testing", async () => {
    const p = await addProvider({ ...local, apiKey: SECRET });
    expect(await probeTarget({ providerId: p.id }, true)).toMatchObject({ baseUrl: "http://127.0.0.1:11434/v1", apiKey: SECRET, model: "llama3.2" });
    expect(await probeTarget({ baseUrl: "http://127.0.0.1:9/v1", model: "m" }, true)).toMatchObject({ apiKey: null });
    await expect(probeTarget({ baseUrl: "http://127.0.0.1:9/v1" }, true)).rejects.toThrow("Name a model to test.");
    await expect(probeTarget({ baseUrl: "https://llm.example.com/v1" }, false)).rejects.toThrow("LLM_ALLOW_REMOTE=1");
    await expect(probeTarget({ providerId: "environment" }, true)).rejects.toThrow("No AI model is set up");
  });
});
