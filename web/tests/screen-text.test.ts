/* The text "Copy output" puts on the clipboard. */
import { describe, expect, it } from "vitest";

import { screenText } from "@/lib/terminal/screen-text";

const line = (text: string, wrapped = false) => ({ text, wrapped });

describe("screenText", () => {
  it("joins lines, trims their ends and drops the empty lines at the bottom", () => {
    expect(screenText([line("$ reconix   "), line(""), line("ready"), line("   "), line("")])).toBe("$ reconix\n\nready");
  });

  it("joins a wrapped line to the one above", () => {
    expect(screenText([line("a long li"), line("ne here", true), line("next")])).toBe("a long line here\nnext");
  });

  it("is empty for an empty screen", () => {
    expect(screenText([line(""), line(" ")])).toBe("");
    expect(screenText([])).toBe("");
  });
});
