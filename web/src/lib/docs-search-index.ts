import { isValidElement, type ReactNode } from "react";

import { DocSection, slugify } from "@/components/docs-primitives";
import { DOCS_CONTENT } from "@/content/docs";
import { COMMANDS, DOCS_ENTRIES } from "@/lib/docs-nav";

/**
 * What the docs search looks through: every page's title and description, its section
 * headings (so "double check" finds the Approval gates page's section) and, for a command
 * page, the command's aliases (so "/agent" finds /assess). Built once on the server by walking
 * the content's React elements for DocSection titles; no page is rendered to do it.
 */
export type DocsSearchEntry = {
  href: string;
  title: string;
  group: string;
  description: string;
  headings: { id: string; title: string }[];
  keywords: string[];
};

function sectionTitles(node: ReactNode, out: string[]): void {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
  if (Array.isArray(node)) {
    for (const child of node) sectionTitles(child, out);
    return;
  }
  if (isValidElement<{ title?: unknown; children?: ReactNode }>(node)) {
    if (node.type === DocSection && typeof node.props.title === "string") out.push(node.props.title);
    sectionTitles(node.props.children, out);
  }
}

let cached: DocsSearchEntry[] | undefined;

export function docsSearchIndex(): DocsSearchEntry[] {
  if (cached) return cached;
  const byName = new Map(COMMANDS.map((c) => [c.name, c]));
  cached = DOCS_ENTRIES.map((e) => {
    const slug = e.href.split("/").pop() ?? "";
    const body = e.isGroup ? undefined : DOCS_CONTENT[e.group.id]?.[slug]?.body;
    const titles: string[] = [];
    sectionTitles(body, titles);
    const command = e.group.id === "commands" ? byName.get(slug) : undefined;
    return {
      href: e.href,
      title: e.title,
      group: e.group.title,
      description: e.description,
      headings: titles.map((t) => ({ id: slugify(t), title: t })),
      keywords: command ? command.aliases.map((a) => `/${a}`) : [],
    };
  });
  return cached;
}
