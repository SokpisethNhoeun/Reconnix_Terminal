/* The model picker's pure rules (components/assistant/): what the composer's chip says
   (model-picker-rules.ts), the rows of step 1 (your models; the providers in their order, a
   cloud one disabled with the reason while the server keeps data here, a saved one's state from
   its address, a cloud preset saved at another address shown as Custom with its host), which
   fields step 2 shows and what Continue asks, where Continue goes with the fetch's and the test's
   answers (only "not listed" falls back to a test or a typed name), the
   requests "Use this model" sends (POST a new provider, or PATCH the saved one and PUT the
   switch), a typed model name (model-name-rules.ts), where the arrow keys move (roving.ts) and
   which word on the model the assistant shows after a switch (model-switch.ts).
   e2e/assistant.spec.ts drives the picker. */
import { describe, expect, it } from "vitest";

import { nameProblem } from "@/components/assistant/model-name-rules";
import {
  addressOf,
  afterFetch,
  afterTest,
  chipState,
  CLOUD_OFF,
  credentialsProblem,
  freeName,
  initialChoice,
  presetFor,
  probeOf,
  providerName,
  providerRows,
  requestsForUse,
  showsUrl,
  startCredentials,
  typeInstead,
  VIEWER_REASON,
  yourModels,
} from "@/components/assistant/model-picker-rules";
import { liveSwitch, switchOver } from "@/components/assistant/model-switch";
import { rovingIndex } from "@/components/assistant/roving";
import type { ModelSummary } from "@/components/assistant/types";
import { fitsPreset, presetOf, PRESETS } from "@/lib/assistant/models/presets";
import { MAX_MODELS } from "@/lib/assistant/models/schema";
import type { ModelsView, ProviderView } from "@/lib/assistant/models/view";

const ID = "0b0e2d55-1c5a-4b1e-9b8c-2f1d3c4b5a69";
const ID2 = "1c1f3e66-2d6b-4c2f-8c9d-3a2e4d5c6b7a";
const STUB = "http://127.0.0.1:3195/v1";

const provider = (over: Partial<ProviderView> = {}): ProviderView => ({ id: ID, name: "Custom", preset: "custom", baseUrl: STUB, models: ["stub-model"], keySaved: false, local: true, ...over });
const view = (over: Partial<ModelsView> = {}): ModelsView => ({
  providers: [],
  environment: { name: "Environment", model: "env-model", local: true, reason: "" },
  active: { providerId: "environment", model: "env-model" },
  summary: { configured: true, name: "env-model", provider: "Environment", local: true, reason: "" },
  allowRemote: false,
  ...over,
});
const none = { baseUrl: "", apiKey: "", removeKey: false };

describe("the chip", () => {
  it("names the model that answers, green, with its provider in the name and the tooltip", () => {
    const chip = chipState({ configured: true, name: "stub-model", provider: "Environment", local: true, reason: "" }, true);
    expect(chip).toMatchObject({ label: "stub-model", name: "Model: stub-model (Environment, local)", tone: "success" });
    expect(chip.title).toContain("Environment");
    const remote = chipState({ configured: true, name: "claude-sonnet-5-5", provider: "Anthropic", local: false, reason: "" }, true);
    expect(remote.name).toBe("Model: claude-sonnet-5-5 (Anthropic, remote)");
    expect(remote.title).toContain("sent to it");
  });
  it("says Choose a model, amber, when none can answer (the reason in the tooltip)", () => {
    const empty = chipState({ configured: false, name: "", provider: "", local: false, reason: "No AI model is set up." }, true);
    expect(empty).toEqual({ label: "Choose a model", name: "Choose a model", title: "No AI model is set up.", tone: "warning" });
    // a chosen model that can't be used any more: the label carries the state too
    const broken = chipState({ configured: false, name: "gpt-4o-mini", provider: "OpenAI", local: false, reason: "OpenAI: not on this machine." }, true);
    expect(broken).toMatchObject({ label: "Choose a model", tone: "warning", title: "OpenAI: not on this machine." });
  });
  it("tells a viewer why it is off", () => {
    expect(chipState({ configured: true, name: "m", provider: "Environment", local: true, reason: "" }, false).title).toBe(VIEWER_REASON);
    expect(VIEWER_REASON).toBe("Choosing a model needs the operator role");
  });
});

describe("step 1: your models", () => {
  it("lists the Environment and every saved model, the active one first and checked", () => {
    const v = view({ providers: [provider({ models: ["stub-model", "stub-model-2"] })], active: { providerId: ID, model: "stub-model-2" } });
    const entries = yourModels(v);
    expect(entries.map((e) => [e.provider, e.model, e.checked])).toEqual([
      ["Custom", "stub-model-2", true],
      ["Environment", "env-model", false],
      ["Custom", "stub-model", false],
    ]);
    expect(entries[1].where).toBe("web/.env.local · local");
  });
  it("disables a remote model while the server keeps data here, and an Environment that can't answer", () => {
    const v = view({
      providers: [provider({ name: "OpenAI", preset: "openai", baseUrl: "https://api.openai.com/v1", local: false, keySaved: true, models: ["gpt-4o-mini"] })],
      environment: { name: "Environment", model: "env-model", local: false, reason: "LLM_BASE_URL is not on this machine." },
    });
    const entries = yourModels(v);
    expect(entries.find((e) => e.model === "gpt-4o-mini")?.disabled).toBe(CLOUD_OFF);
    expect(entries.find((e) => e.model === "env-model")?.disabled).toBe("LLM_BASE_URL is not on this machine.");
    expect(yourModels(view({ allowRemote: true, providers: v.providers })).find((e) => e.model === "gpt-4o-mini")?.disabled).toBeNull();
  });
  it("is empty without the Environment and a saved model", () => {
    expect(yourModels(view({ environment: null, active: null }))).toEqual([]);
  });
});

describe("step 1: the providers", () => {
  it("are the presets in the plan's order, with their state", () => {
    const rows = providerRows(view());
    expect(rows.map((r) => r.label)).toEqual(["OpenAI", "Anthropic", "DeepSeek", "OpenRouter", "Groq", "Ollama (local)", "LM Studio (local)", "Custom (OpenAI-compatible)"]);
    expect(rows.map((r) => r.state)).toEqual(["cloud", "cloud", "cloud", "cloud", "cloud", "local", "local", ""]);
    expect(rows.every((r) => r.provider === null)).toBe(true);
  });
  it("disable every cloud row, with the reason, unless the server allows remote models", () => {
    const off = providerRows(view());
    expect(off.filter((r) => r.disabled).map((r) => r.preset.id)).toEqual(["openai", "anthropic", "deepseek", "openrouter", "groq"]);
    expect(off.find((r) => r.preset.id === "anthropic")?.disabled).toBe("Start the dashboard with LLM_ALLOW_REMOTE=1 to use cloud models");
    expect(providerRows(view({ allowRemote: true })).some((r) => r.disabled)).toBe(false);
  });
  it("are the saved provider made from a preset, in its place (a saved key says so)", () => {
    const saved = provider({ keySaved: true });
    const older = provider({ id: ID2, name: "My vLLM", baseUrl: "http://127.0.0.1:8000/v1" }); // saved before the picker
    const rows = providerRows(view({ providers: [saved, older] }));
    const custom = rows.filter((r) => r.preset.id === "custom");
    expect(custom.map((r) => [r.key, r.label, r.state])).toEqual([
      [ID, "Custom (OpenAI-compatible)", "key saved"],
      [ID2, "My vLLM", "local"],
    ]);
    expect(custom[0].provider).toBe(saved);
    expect(rows).toHaveLength(PRESETS.length + 1);
  });
  it("say where a saved provider is from its address, never from its preset's kind", () => {
    const remoteOllama = provider({ name: "Ollama", preset: "ollama", baseUrl: "https://ollama.example.com/v1", local: false });
    const row = providerRows(view({ providers: [remoteOllama] })).find((r) => r.provider === remoteOllama);
    expect(row).toMatchObject({ label: "Ollama", state: "remote", disabled: null });
    expect(row?.label).not.toContain("(local)");
    const withKey = provider({ name: "Ollama", preset: "ollama", baseUrl: "https://ollama.example.com/v1", local: false, keySaved: true });
    expect(providerRows(view({ providers: [withKey] })).find((r) => r.provider === withKey)?.state).toBe("key saved");
    const here = provider({ name: "Ollama", preset: "ollama", baseUrl: "http://127.0.0.1:11434/v1" });
    expect(providerRows(view({ providers: [here] })).find((r) => r.provider === here)).toMatchObject({ label: "Ollama (local)", state: "local" });
    const vllm = provider({ name: "vLLM box", baseUrl: "https://vllm.example.com/v1", local: false }); // once "saved"
    expect(providerRows(view({ providers: [vllm] })).find((r) => r.provider === vllm)?.state).toBe("remote");
  });
  it("tie a cloud preset to its own address: one saved elsewhere before that rule is Custom, with its host", () => {
    const openai = presetOf("openai");
    expect(fitsPreset(openai, "https://api.openai.com/v1")).toBe(true);
    expect(fitsPreset(openai, "https://API.openai.com:443/v2")).toBe(true); // the same origin
    for (const other of ["http://api.openai.com/v1", "https://api.openai.com:8443/v1", "https://api.openai.com.evil.example/v1", "https://other.example/v1", "nope"]) {
      expect(fitsPreset(openai, other)).toBe(false);
    }
    expect(fitsPreset(presetOf("custom"), "https://other.example/v1")).toBe(true);
    expect(fitsPreset(presetOf("ollama"), "https://ollama.example.com/v1")).toBe(true);

    const real = provider({ id: ID2, name: "OpenAI", preset: "openai", baseUrl: "https://api.openai.com/v1", local: false, keySaved: true });
    const moved = provider({ name: "OpenAI", preset: "openai", baseUrl: "https://llm.other.example/v1", local: false, keySaved: true });
    expect(presetFor(real).id).toBe("openai");
    expect(presetFor(moved).id).toBe("custom");
    const rows = providerRows(view({ providers: [real, moved] }));
    expect(rows.filter((r) => r.preset.id === "openai").map((r) => [r.key, r.label, r.disabled])).toEqual([[ID2, "OpenAI", CLOUD_OFF]]);
    const shown = rows.find((r) => r.provider === moved)!;
    expect(shown).toMatchObject({ label: "OpenAI (llm.other.example)", state: "key saved", disabled: null });
    expect(shown.preset.id).toBe("custom");
    expect(showsUrl(shown.preset)).toBe(true); // its address in the field
    expect(startCredentials(shown.preset, moved).baseUrl).toBe("https://llm.other.example/v1");
    expect(providerName(shown.preset, moved)).toBe("OpenAI (llm.other.example)");
    const yours = yourModels(view({ allowRemote: true, providers: [real, moved] }));
    expect(yours.filter((e) => e.providerId !== "environment").map((e) => e.provider)).toEqual(["OpenAI", "OpenAI (llm.other.example)"]);
    // a change saves it as Custom (the server refuses the cloud's name at another address)
    const used = requestsForUse(shown.preset, moved, view({ providers: [real, moved] }), startCredentials(shown.preset, moved), "stub-model");
    expect(used.ok && used.requests.kind === "update" && used.requests.body).toEqual({ preset: "custom" });
    const same = requestsForUse(presetOf("openai"), real, view({ providers: [real] }), startCredentials(presetOf("openai"), real), "stub-model");
    expect(same.ok && same.requests.kind === "update" && same.requests.body).toBeNull();
  });
});

describe("step 2: credentials", () => {
  const custom = presetOf("custom");
  const ollama = presetOf("ollama");
  const anthropic = presetOf("anthropic");

  it("show the base URL only for Custom, Ollama and LM Studio, filled in from the saved address or the preset", () => {
    expect(PRESETS.filter(showsUrl).map((p) => p.id)).toEqual(["ollama", "lmstudio", "custom"]);
    expect(startCredentials(ollama, null)).toEqual({ baseUrl: "http://127.0.0.1:11434/v1", apiKey: "", removeKey: false });
    expect(startCredentials(custom, provider()).baseUrl).toBe(STUB);
    expect(startCredentials(custom, provider({ keySaved: true })).apiKey).toBe(""); // never filled in
    // a cloud preset's address is fixed: whatever the field held
    expect(addressOf(anthropic, null, { ...none, baseUrl: "http://evil.example" })).toBe("https://api.anthropic.com/v1");
  });
  it("say what is missing before anything is sent", () => {
    expect(credentialsProblem(custom, null, none)).toBe("Give the base URL (it usually ends in /v1).");
    expect(credentialsProblem(custom, null, { ...none, baseUrl: STUB })).toBeNull(); // a key is optional
    expect(credentialsProblem(anthropic, null, none)).toBe("Anthropic needs an API key.");
    expect(credentialsProblem(anthropic, null, { ...none, apiKey: "sk ant" })).toBe("An API key is printable characters without spaces.");
    expect(credentialsProblem(anthropic, null, { ...none, apiKey: "sk-ant-0123" })).toBeNull();
    const kept = provider({ name: "Anthropic", preset: "anthropic", baseUrl: anthropic.baseUrl, keySaved: true, local: false });
    expect(credentialsProblem(anthropic, kept, none)).toBeNull(); // the saved key is kept
    expect(credentialsProblem(anthropic, kept, { ...none, removeKey: true })).toBe("Anthropic needs an API key.");
  });
  it("ask a saved provider by its id while it is as saved, else as typed with only the key typed here", () => {
    const saved = provider({ keySaved: true });
    expect(probeOf(custom, saved, startCredentials(custom, saved))).toEqual({ providerId: ID });
    expect(probeOf(custom, saved, startCredentials(custom, saved), "stub-model")).toEqual({ providerId: ID, model: "stub-model" });
    // another address: the saved key never goes there
    expect(probeOf(custom, saved, { ...none, baseUrl: "http://127.0.0.1:9/v1" })).toEqual({ baseUrl: "http://127.0.0.1:9/v1" });
    expect(probeOf(custom, saved, { ...none, baseUrl: STUB, apiKey: " new-key " })).toEqual({ baseUrl: STUB, apiKey: "new-key" });
    expect(probeOf(custom, saved, { ...none, baseUrl: STUB, removeKey: true })).toEqual({ baseUrl: STUB });
    expect(probeOf(anthropic, null, { ...none, apiKey: "sk-ant-0123" }, "claude-x")).toEqual({ baseUrl: "https://api.anthropic.com/v1", model: "claude-x", apiKey: "sk-ant-0123" });
  });
});

describe("Continue", () => {
  it("goes on with the list the server gave", () => {
    expect(afterFetch({ ok: true, models: ["stub-model", "stub-model-2"] }, [])).toEqual({ next: "choose", models: ["stub-model", "stub-model-2"], note: null, verify: false });
    // an empty list: a typed name, tested before it is saved
    expect(afterFetch({ ok: true, models: [] }, [])).toMatchObject({ next: "choose", models: [], verify: true });
  });
  it("stays on a refusal or a failure, with the server's words, and never falls back", () => {
    const refused = { ok: false as const, status: 400, detail: "The base URL is not on this machine: assessment data would be sent there." };
    expect(afterFetch(refused, ["m"])).toEqual({ next: "stay", error: refused.detail, typeInstead: false });
    expect(afterFetch({ ok: false, status: 429, detail: "Too many requests at once." }, [])).toMatchObject({ next: "stay", typeInstead: false });
    // the model's server never reached, a redirect, a refused key, its limit, a list too large:
    // fixed here first (no test of a known model, no typed name)
    for (const detail of [
      "Could not reach the address. Is the model's server running?",
      "The address did not answer within 10 seconds.",
      "The address answered with a redirect, which is not followed. Use the final address.",
      "The model's server answered HTTP 401: check the API key.",
      "The model's server answered HTTP 429: too many requests, or no credit left.",
      "The model list is too large.",
    ]) {
      expect(afterFetch({ ok: false, status: 502, detail }, ["llama3.2"])).toEqual({ next: "stay", error: detail, typeInstead: false });
    }
  });
  it("tests a known model when the model's server answered without a list, else offers to type one", () => {
    const unlisted = { ok: true as const, listed: false as const, detail: "The model's server answered HTTP 404: check the model name and the base URL." };
    expect(afterFetch(unlisted, ["llama3.2", "qwen"])).toEqual({ next: "test", model: "llama3.2" });
    expect(afterFetch(unlisted, [])).toEqual({ next: "stay", error: unlisted.detail, typeInstead: true });
    expect(afterTest({ ok: true, result: { ok: true, detail: "Connected: llama3.2 answered." } }, ["llama3.2", "qwen"])).toMatchObject({ next: "choose", models: ["llama3.2", "qwen"], verify: false });
    expect(afterTest({ ok: true, result: { ok: false, detail: "The model's server answered HTTP 401: check the API key." } }, ["llama3.2"])).toEqual({
      next: "stay",
      error: "The model's server answered HTTP 401: check the API key.",
      typeInstead: true,
    });
    expect(afterTest({ ok: false, status: 400, detail: "An API key is only sent over https to a remote model." }, ["m"])).toMatchObject({ next: "stay", typeInstead: false });
    expect(typeInstead()).toMatchObject({ next: "choose", models: [], verify: true });
  });
});

describe("step 3: the model", () => {
  it("starts on the provider's active model, else its first saved one, else the first listed, else typing", () => {
    const saved = provider({ models: ["b", "c"] });
    expect(initialChoice(["a", "b", "c"], saved, view({ providers: [saved], active: { providerId: ID, model: "c" } }))).toBe("c");
    expect(initialChoice(["a", "b", "c"], saved, view({ providers: [saved] }))).toBe("b");
    expect(initialChoice(["a", "x"], saved, view({ providers: [saved] }))).toBe("a");
    expect(initialChoice([], null, view())).toBeNull();
  });
  it("checks a typed model name", () => {
    expect(nameProblem("openai/gpt-4o-mini")).toBeNull();
    expect(nameProblem("  qwen:7b@q4 ")).toBeNull();
    expect(nameProblem("   ")).toBe("Type a model name.");
    expect(nameProblem("two words")).toContain("letters, digits");
    expect(nameProblem("x".repeat(129))).toContain("at most 128");
  });
});

describe("Use this model", () => {
  const custom = presetOf("custom");
  const anthropic = presetOf("anthropic");

  it("adds a provider not saved yet, named after its preset, with the chosen model, made active", () => {
    const built = requestsForUse(custom, null, view(), { ...none, baseUrl: ` ${STUB} `, apiKey: " k-1 " }, "stub-model-2");
    expect(built).toEqual({ ok: true, requests: { kind: "add", body: { name: "Custom", preset: "custom", baseUrl: STUB, models: ["stub-model-2"], apiKey: "k-1", activate: true } } });
    const cloud = requestsForUse(anthropic, null, view(), { ...none, apiKey: "sk-ant-0123" }, "claude-x");
    expect(cloud.ok && cloud.requests).toEqual({ kind: "add", body: { name: "Anthropic", preset: "anthropic", baseUrl: "https://api.anthropic.com/v1", models: ["claude-x"], apiKey: "sk-ant-0123", activate: true } });
    // no key typed: none sent
    const keyless = requestsForUse(custom, null, view(), { ...none, baseUrl: STUB }, "m");
    expect(keyless.ok && keyless.requests.kind === "add" && "apiKey" in keyless.requests.body).toBe(false);
  });
  it("picks a name no other saved provider has", () => {
    expect(freeName("Custom", [])).toBe("Custom");
    expect(freeName("Custom", [provider({ name: "custom" }), provider({ id: ID2, name: "Custom 2" })])).toBe("Custom 3");
    const taken = view({ providers: [provider({ name: "Anthropic", preset: "custom" })] }); // a Custom saved under that name
    const built = requestsForUse(anthropic, null, taken, { ...none, apiKey: "sk-ant-0123" }, "claude-x");
    expect(built.ok && built.requests.kind === "add" && built.requests.body.name).toBe("Anthropic 2");
  });
  it("changes the saved provider (the chosen model added, a typed key, a new address) and switches to it", () => {
    const saved = provider({ models: ["stub-model"], keySaved: true });
    const v = view({ providers: [saved] });
    const built = requestsForUse(custom, saved, v, { ...none, baseUrl: "http://127.0.0.1:8000/v1", apiKey: "new-key" }, "stub-model-2");
    expect(built).toEqual({
      ok: true,
      requests: {
        kind: "update",
        id: ID,
        body: { baseUrl: "http://127.0.0.1:8000/v1", models: ["stub-model", "stub-model-2"], apiKey: "new-key" },
        activate: { providerId: ID, model: "stub-model-2" },
      },
    });
  });
  it("only switches when nothing changed, and removes the key when asked (a typed key wins)", () => {
    const saved = provider({ models: ["stub-model", "stub-model-2"], keySaved: true });
    const v = view({ providers: [saved] });
    const same = requestsForUse(custom, saved, v, startCredentials(custom, saved), "stub-model-2");
    expect(same).toEqual({ ok: true, requests: { kind: "update", id: ID, body: null, activate: { providerId: ID, model: "stub-model-2" } } });
    const removed = requestsForUse(custom, saved, v, { ...startCredentials(custom, saved), removeKey: true }, "stub-model");
    expect(removed.ok && removed.requests.kind === "update" && removed.requests.body).toEqual({ removeKey: true });
    const replaced = requestsForUse(custom, saved, v, { ...startCredentials(custom, saved), removeKey: true, apiKey: "k2" }, "stub-model");
    expect(replaced.ok && replaced.requests.kind === "update" && replaced.requests.body).toEqual({ apiKey: "k2" });
    // no key saved: nothing to remove
    const keyless = provider({ models: ["stub-model"] });
    const nothing = requestsForUse(custom, keyless, view({ providers: [keyless] }), { ...startCredentials(custom, keyless), removeKey: true }, "stub-model");
    expect(nothing.ok && nothing.requests.kind === "update" && nothing.requests.body).toBeNull();
  });
  it("refuses a model past the provider's limit", () => {
    const full = provider({ models: Array.from({ length: MAX_MODELS }, (_, i) => `m${i}`) });
    const built = requestsForUse(custom, full, view({ providers: [full] }), startCredentials(custom, full), "one-more");
    expect(built.ok).toBe(false);
    expect(!built.ok && built.problem).toContain(`${MAX_MODELS} models`);
    expect(requestsForUse(custom, full, view({ providers: [full] }), startCredentials(custom, full), "m3").ok).toBe(true); // already saved
  });
});

describe("the arrow keys in the picker's lists", () => {
  it("move focus, wrapping, with Home and End; other keys don't", () => {
    expect(rovingIndex("ArrowDown", 0, 3)).toBe(1);
    expect(rovingIndex("ArrowRight", 2, 3)).toBe(0);
    expect(rovingIndex("ArrowUp", 0, 3)).toBe(2);
    expect(rovingIndex("ArrowLeft", 1, 3)).toBe(0);
    expect(rovingIndex("Home", 2, 3)).toBe(0);
    expect(rovingIndex("End", 0, 3)).toBe(2);
    expect(rovingIndex("Enter", 0, 3)).toBeNull(); // Enter and Space choose: the button's own click
    expect(rovingIndex(" ", 0, 3)).toBeNull();
    expect(rovingIndex("ArrowDown", -1, 3)).toBeNull(); // focus is elsewhere
    expect(rovingIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("the model the assistant shows after a switch", () => {
  const summary = (name: string, over: Partial<ModelSummary> = {}): ModelSummary => ({ configured: true, name, provider: "Ollama", local: true, reason: "", ...over });
  const A = summary("llama3.2");
  const B = summary("qwen:7b");

  it("is the picker's while the page still names the model it replaced", () => {
    const s = switchOver(A, B);
    expect(liveSwitch(A, s)?.model).toBe(B);
    expect(liveSwitch({ ...A }, s)?.model).toBe(B); // a live refresh rendered before the switch: a new object, the old model
    expect(liveSwitch({ ...A, configured: false, reason: "down" }, s)?.model).toBe(B); // the old model, in another state
  });
  it("is the page's once it has caught up, or moved on", () => {
    const s = switchOver(A, B);
    expect(liveSwitch({ ...B }, s)).toBeNull(); // the server knows of the switch
    expect(liveSwitch(summary("phi4"), s)).toBeNull(); // another change since
    expect(liveSwitch(A, null)).toBeNull();
  });
  it("follows a change of state alone (an edit of the active provider)", () => {
    const broken = summary("llama3.2", { configured: false, reason: "The base URL is not on this machine." });
    const s = switchOver(broken, A); // fixed in the picker
    expect(liveSwitch(broken, s)?.model).toBe(A); // a render from before the fix
    expect(liveSwitch({ ...A }, s)).toBeNull(); // the page says the same now: its word from here on
  });
});
