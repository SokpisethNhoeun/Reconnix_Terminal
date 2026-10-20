import { LayoutGrid, Network, Puzzle, Route, Sparkles, Target, type LucideIcon } from "lucide-react";
import { DOCS_NAV } from "@/lib/docs-nav";

export type NavItem = { label: string; href: string; description: string; icon?: LucideIcon };

export type NavMenu = {
  id: string;
  label: string;
  /** where the menu's name itself points (footer one-line nav) */
  href: string;
  items: NavItem[];
  /** panel columns on desktop */
  columns: 1 | 2;
  /** optional link at the bottom of the panel */
  footer?: { label: string; href: string };
};

const guardrails = DOCS_NAV.find((g) => g.id === "guardrails")!;

/**
 * The navbar's four dropdowns. Features / How it works point at landing-page sections
 * (short, "what Reconix can do"); Guardrails / Docs point at the docs (detail), built from DOCS_NAV.
 */
export const NAV_MENUS: NavMenu[] = [
  {
    id: "features",
    label: "Features",
    href: "/",
    columns: 2,
    items: [
      { label: "Purpose", href: "/", description: "AI-planned security assessments inside an approved scope.", icon: Target },
      { label: "Key features", href: "/docs", description: "Scope, policy, tools, analysis, knowledge and reports.", icon: Sparkles },
      { label: "Integrations", href: "/docs/assessment-guide/plan", description: "The approved tools and the stack you run yourself.", icon: Puzzle },
      { label: "Assessment categories", href: "/docs/assessment-guide/request", description: "Network, API, Source Code and Web URL.", icon: LayoutGrid },
    ],
  },
  {
    id: "how",
    label: "How it works",
    href: "/docs/assessment-guide",
    columns: 1,
    items: [
      { label: "Assessment flow", href: "/docs/assessment-guide", description: "Seven steps, one approval gate you can't skip.", icon: Route },
      { label: "Architecture", href: "/docs/getting-started/introduction", description: "Terminal, backend, AI service and tool service.", icon: Network },
    ],
  },
  {
    id: "guardrails",
    label: "Guardrails",
    href: guardrails.href,
    columns: 2,
    items: guardrails.pages.map((p) => ({ label: p.title, href: p.href, description: p.description })),
  },
  {
    id: "docs",
    label: "Docs",
    href: "/docs",
    columns: 2,
    items: DOCS_NAV.map((g) => ({ label: g.title, href: g.href, description: g.description, icon: g.icon })),
    footer: { label: "Browse all docs", href: "/docs" },
  },
];
