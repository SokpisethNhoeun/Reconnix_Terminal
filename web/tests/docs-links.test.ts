/* Every docs address a component names is a live page: the components link through the DOCS
   map (lib/docs-nav.ts), and any `/docs/…` string left under src/components is checked against
   DOCS_ROUTES, so the docs can move again by changing docs-nav.ts alone. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DOCS, DOCS_ROUTES } from "@/lib/docs-nav";

const COMPONENTS = path.join(__dirname, "..", "src", "components");
const DOCS_LINK = /["'`](\/docs(?:\/[a-z0-9-]+)*)(?:#[a-z0-9-]+)?["'`]/g;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.tsx?$/.test(name)) yield full;
  }
}

/** Every `/docs/…` literal in the components, with where it is. */
function docsLiterals(): { file: string; href: string }[] {
  const out: { file: string; href: string }[] = [];
  for (const file of files(COMPONENTS)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(DOCS_LINK)) out.push({ file: path.relative(COMPONENTS, file), href: m[1] });
  }
  return out;
}

describe("the docs links in the components", () => {
  const live = new Set<string>(DOCS_ROUTES);

  it("each name a live docs page", () => {
    const found = docsLiterals();
    expect(found.length).toBeGreaterThan(0);
    for (const { file, href } of found) expect(live.has(href), `${file} links to ${href}`).toBe(true);
  });

  it("the dashboard's components go through the DOCS map", () => {
    const literal = docsLiterals().filter(({ file }) => file.startsWith("dashboard/"));
    expect(literal.map(({ file, href }) => `${file}: ${href}`)).toEqual([]);
  });

  it("the DOCS map names only live pages", () => {
    for (const [key, href] of Object.entries(DOCS)) expect(live.has(href), `DOCS.${key}`).toBe(true);
  });
});
