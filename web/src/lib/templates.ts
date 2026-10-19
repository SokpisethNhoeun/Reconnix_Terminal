/* The four assessment types. The saved data uses longer template names ("Web URL", "Source
   Code", …); everywhere the dashboard shows a type it uses the short label, and filters match
   a type to whichever template names belong to it. */

export const TEMPLATE_TYPES = [
  { label: "Web", match: /web/i },
  { label: "API", match: /api/i },
  { label: "Code", match: /code|source/i },
  { label: "Network", match: /network/i },
] as const;

export type TemplateLabel = (typeof TEMPLATE_TYPES)[number]["label"];

export const TEMPLATE_LABELS: TemplateLabel[] = TEMPLATE_TYPES.map((t) => t.label);

/** The short type label for a template name ("Web URL" → "Web"); the name itself if unknown. */
export function templateLabel(name: string): string {
  return TEMPLATE_TYPES.find((t) => t.match.test(name))?.label ?? (name || "—");
}

/** Whether a template name belongs to a type (by its label), used when filtering. */
export function matchesTemplateType(name: string, label: string): boolean {
  const type = TEMPLATE_TYPES.find((t) => t.label === label);
  return type ? type.match.test(name) : false;
}
