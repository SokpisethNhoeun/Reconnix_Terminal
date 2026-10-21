/* The docs structure: every page has content and vice versa, every command of the generated
   reference has a hand-written page, every old address still resolves, and the search finds
   what the specs promise. */
import { describe, expect, it } from "vitest";

import { searchDocs } from "@/components/docs-search";
import { DOCS_CONTENT } from "@/content/docs";
import { COMMAND_DOCS, STALE_COMMAND_DOCS, UNDOCUMENTED_COMMANDS } from "@/content/docs/commands";
import commandsJson from "@/content/docs/commands.json";
import { COMMANDS, COMMAND_GROUPS, DOCS, DOCS_ENTRIES, DOCS_NAV, DOCS_ROUTES, docNeighbours, findDoc } from "@/lib/docs-nav";
import { DOCS_REDIRECTS, OLD_DOCS_ROUTES } from "@/lib/docs-redirects";
import { docsSearchIndex } from "@/lib/docs-search-index";

const slugOf = (href: string) => href.split("/").pop()!;

describe("the docs structure", () => {
  it("has unique routes under /docs", () => {
    expect(new Set(DOCS_ROUTES).size).toBe(DOCS_ROUTES.length);
    for (const route of DOCS_ROUTES) expect(route).toMatch(/^\/docs(\/[a-z0-9-]+){0,2}$/);
  });

  it("lists the groups the plan asks for, in order", () => {
    expect(DOCS_NAV.map((g) => g.id)).toEqual([
      "overview",
      "getting-started",
      "terminal-guide",
      "ai-models",
      "commands",
      "assessment-guide",
      "reports",
      "troubleshooting",
      "guardrails",
    ]);
  });

  it("has content for every page, and a page for every content entry", () => {
    for (const g of DOCS_NAV) {
      if (g.pages.length === 0) continue;
      const content = DOCS_CONTENT[g.id];
      expect(content, `content for ${g.id}`).toBeDefined();
      for (const p of g.pages) {
        expect(p.href.startsWith(`${g.href}/`), p.href).toBe(true);
        expect(content[slugOf(p.href)], `content for ${p.href}`).toBeDefined();
        expect(content[slugOf(p.href)].lede.length).toBeGreaterThan(0);
      }
      for (const slug of Object.keys(content)) expect(findDoc(`${g.href}/${slug}`), `${g.id}/${slug} in DOCS_NAV`).toBeDefined();
    }
    for (const id of Object.keys(DOCS_CONTENT)) expect(DOCS_NAV.some((g) => g.id === id), `group ${id}`).toBe(true);
  });

  it("walks prev/next through every readable page once", () => {
    const reading = DOCS_ENTRIES.filter((e) => !e.isGroup || e.group.pages.length === 0);
    for (let i = 0; i < reading.length; i++) {
      const { prev, next } = docNeighbours(reading[i].href);
      expect(prev?.href).toBe(reading[i - 1]?.href);
      expect(next?.href).toBe(reading[i + 1]?.href);
    }
  });
});

describe("the generated command reference", () => {
  it("comes from commands.json and covers every command once", () => {
    expect(COMMAND_GROUPS).toBe(commandsJson.groups);
    expect(COMMANDS.length).toBe(commandsJson.count);
    expect(new Set(COMMANDS.map((c) => c.name)).size).toBe(COMMANDS.length);
    expect(COMMANDS.length).toBe(commandsJson.count);
  });

  it("has a hand-written page for every command, and no page for a command that is gone", () => {
    expect(UNDOCUMENTED_COMMANDS).toEqual([]);
    expect(STALE_COMMAND_DOCS).toEqual([]);
    expect(Object.keys(COMMAND_DOCS).sort()).toEqual(COMMANDS.map((c) => c.name).sort());
  });

  it("lists one nav page and one content page per command", () => {
    const group = DOCS_NAV.find((g) => g.id === "commands")!;
    expect(group.pages.map((p) => slugOf(p.href))).toEqual(COMMANDS.map((c) => c.name));
    expect(Object.keys(DOCS_CONTENT.commands).sort()).toEqual(COMMANDS.map((c) => c.name).sort());
    for (const c of COMMANDS) {
      const doc = COMMAND_DOCS[c.name];
      expect(doc.syntax.startsWith(`/${c.name}`), `${c.name} syntax`).toBe(true);
      expect(doc.example.startsWith(`/${c.name}`), `${c.name} example`).toBe(true);
      expect(DOCS_CONTENT.commands[c.name].lede).toBe(c.description);
    }
  });
});

describe("the old addresses", () => {
  const live = new Set(DOCS_ROUTES);
  const redirected = new Map(DOCS_REDIRECTS.map((r) => [r.source, r.destination]));

  it("each still exist or redirect to a page that exists", () => {
    for (const old of OLD_DOCS_ROUTES) {
      const target = redirected.get(old);
      if (live.has(old)) expect(target, `${old} exists and must not redirect`).toBeUndefined();
      else expect(target && live.has(target), `${old} → ${target}`).toBe(true);
    }
  });

  it("redirect once, from an address that is no longer a page, and each only once", () => {
    expect(new Set(DOCS_REDIRECTS.map((r) => r.source)).size).toBe(DOCS_REDIRECTS.length);
    for (const r of DOCS_REDIRECTS) {
      expect(OLD_DOCS_ROUTES).toContain(r.source);
      expect(live.has(r.source), `${r.source} is a live page`).toBe(false);
      expect(redirected.has(r.destination), `${r.destination} redirects again`).toBe(false);
      expect(r.source).not.toBe(r.destination);
    }
  });

  it("send the dashboard's Configuration link to the AI models configuration", () => {
    expect(redirected.get("/docs/getting-started/configuration")).toBe("/docs/ai-models/configuration");
  });
});

describe("the docs search", () => {
  const index = docsSearchIndex();

  it("indexes every page with its headings", () => {
    expect(index.map((e) => e.href)).toEqual(DOCS_ROUTES);
    for (const e of index) {
      const entry = findDoc(e.href)!;
      if (!entry.isGroup) expect(e.headings.length, `${e.href} headings`).toBeGreaterThan(0);
      for (const h of e.headings) expect(h.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("finds a command by its name and by an alias", () => {
    expect(searchDocs(index, "/model")[0].href).toBe("/docs/commands/model");
    expect(searchDocs(index, "model")[0].href).toBe("/docs/commands/model");
    expect(searchDocs(index, "/agent")[0].href).toBe("/docs/commands/assess");
    expect(searchDocs(index, "/dashboard").map((h) => h.href)).toContain("/docs/commands/web");
  });

  it("finds a section heading and links to it", () => {
    const hit = searchDocs(index, "double check").find((h) => h.href.startsWith("/docs/assessment-guide/approval-gates"));
    expect(hit?.href).toBe("/docs/assessment-guide/approval-gates#high-risk-the-double-check");
    expect(searchDocs(index, "")).toEqual([]);
    expect(searchDocs(index, "zzz-no-such-thing")).toEqual([]);
  });
});

describe("the DOCS link map", () => {
  it("names only live pages", () => {
    for (const [key, href] of Object.entries(DOCS)) {
      expect(DOCS_ROUTES, `DOCS.${key}`).toContain(href);
    }
  });
});
