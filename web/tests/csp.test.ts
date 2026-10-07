/* The Content-Security-Policy: nonce'd scripts, nothing framed — except the export route,
   which the preview page frames from the same origin. */
import { afterEach, describe, expect, it } from "vitest";

import { EXPORT_ROUTE, contentSecurityPolicy } from "@/lib/auth/csp";

const directives = (policy: string) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d]));

describe("contentSecurityPolicy", () => {
  it("carries the script nonce and forbids framing by default", () => {
    const d = directives(contentSecurityPolicy("n0nce", "/assessments/x"));
    expect(d["script-src"]).toContain("'nonce-n0nce'");
    expect(d["script-src"]).toContain("'strict-dynamic'");
    expect(d["frame-ancestors"]).toBe("frame-ancestors 'none'");
    expect(d["object-src"]).toBe("object-src 'none'");
    expect(d["frame-src"]).toBe("frame-src 'self'");
  });

  it("lets only the export route be framed, and only by this origin", () => {
    expect(directives(contentSecurityPolicy("n", "/api/assessments/20261005-140300-9f76_RCX-DEMO-001/export"))["frame-ancestors"]).toBe(
      "frame-ancestors 'self'",
    );
    for (const path of ["/api/assessments/u1", "/api/assessments/u1/export/x", "/assessments/u1/export", "/login"]) {
      expect(EXPORT_ROUTE.test(path)).toBe(false);
      expect(directives(contentSecurityPolicy("n", path))["frame-ancestors"]).toBe("frame-ancestors 'none'");
    }
  });
});

describe("the terminal helper", () => {
  afterEach(() => {
    delete process.env.RECONIX_WEB_TERMINAL;
    delete process.env.RECONIX_TERM_PORT;
  });

  it("may be reached from every page while the terminal is on", () => {
    process.env.RECONIX_WEB_TERMINAL = "1";
    process.env.RECONIX_TERM_PORT = "4101";
    for (const path of ["/", "/terminal", "/findings"]) {
      expect(directives(contentSecurityPolicy("n", path))["connect-src"]).toContain("ws://127.0.0.1:4101");
    }
  });

  it("may not be reached when the terminal is off", () => {
    expect(directives(contentSecurityPolicy("n", "/terminal"))["connect-src"]).not.toContain("127.0.0.1");
  });
});
