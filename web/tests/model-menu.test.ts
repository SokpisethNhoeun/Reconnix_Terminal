/* The Model menu's pure rules (components/assistant/): where the arrow keys move between a
   provider's models (roving.ts). e2e/assistant.spec.ts drives the menu. */
import { describe, expect, it } from "vitest";

import { rovingIndex } from "@/components/assistant/roving";

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
