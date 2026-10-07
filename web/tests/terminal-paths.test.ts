/* Which paths the proxy keeps for operators. */
import { describe, expect, it } from "vitest";

import { isTerminalPath } from "@/lib/terminal/paths";

describe("isTerminalPath", () => {
  it.each(["/terminal", "/api/terminal", "/api/terminal/ticket", "/api/terminal/anything/else"])("guards %s", (path) => {
    expect(isTerminalPath(path)).toBe(true);
  });

  it.each(["/", "/terminals", "/terminal/x", "/api/terminals", "/api/assessments/terminal", "/findings"])("leaves %s alone", (path) => {
    expect(isTerminalPath(path)).toBe(false);
  });
});
