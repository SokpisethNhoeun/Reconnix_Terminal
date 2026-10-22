/* The Model menu's pure rules (components/assistant/): the form's model names, counting a name
   typed but not added yet (model-name-rules.ts); and where the arrow keys move between a
   provider's models (roving.ts). e2e/assistant.spec.ts drives the menu. */
import { describe, expect, it } from "vitest";

import { nameProblem, namesToSave } from "@/components/assistant/model-name-rules";
import { rovingIndex } from "@/components/assistant/roving";
import { MAX_MODELS } from "@/lib/assistant/models/schema";

describe("the model names a Save uses", () => {
  it("take a name typed but not added yet", () => {
    expect(namesToSave([], "llama3.2")).toEqual({ ok: true, names: ["llama3.2"] });
    expect(namesToSave(["a"], "  qwen:7b  ")).toEqual({ ok: true, names: ["a", "qwen:7b"] });
    expect(namesToSave(["a"], "")).toEqual({ ok: true, names: ["a"] });
    expect(namesToSave(["a"], "   ")).toEqual({ ok: true, names: ["a"] });
    expect(namesToSave(["a"], "a")).toEqual({ ok: true, names: ["a"] }); // listed already: nothing to add
    expect(namesToSave([], "")).toEqual({ ok: true, names: [] }); // the form then asks for one
  });
  it("stop the save, saying why, when the typed name can't be one", () => {
    const bad = namesToSave(["a"], "two words");
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.problem).toMatch(/^The model name you typed isn't in the list yet: A model name uses/);
    const full = Array.from({ length: MAX_MODELS }, (_, i) => `m${i}`);
    expect(!namesToSave(full, "one-more").ok).toBe(true);
    expect(namesToSave(full, "m0")).toEqual({ ok: true, names: full });
  });
  it("are the rules the Add button uses", () => {
    expect(nameProblem("openai/gpt-4o-mini", [])).toBeNull();
    expect(nameProblem("x", ["x"])).toBe("That model is listed already.");
    expect(nameProblem("bad name", [])).toContain("letters, digits");
  });
});

describe("the arrow keys in a provider's models", () => {
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
