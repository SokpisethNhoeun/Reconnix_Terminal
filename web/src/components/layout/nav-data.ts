/* The dashboard's pages, in sidebar order: the sidebar (NavLinks) and the About page's
   "Where to look" list are both built from this. Plain data, so server and client code can
   import it. `operator` pages are only listed for operators. */
import {
  BookOpen,
  LayoutDashboard,
  List,
  type LucideIcon,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
} from "lucide-react";

import { TERMINAL_PAGE } from "@/lib/terminal/paths";

export interface NavPage {
  href: string;
  label: string;
  short: string; // the label on phones, where the links sit side by side
  icon: LucideIcon;
  count?: "assessments" | "findings";
  operator?: boolean;
  about: string; // one line for the About page
}

export const NAV_PAGES: NavPage[] = [
  {
    href: "/",
    label: "Overview",
    short: "Overview",
    icon: LayoutDashboard,
    about: "Counts and charts across every saved assessment, and what waits for you.",
  },
  {
    href: "/assessments",
    label: "Assessments",
    short: "Assessments",
    icon: List,
    count: "assessments",
    about: "Each run with its plan, timeline, policy checks, findings, scope, approvals and exports.",
  },
  {
    href: "/findings",
    label: "Findings",
    short: "Findings",
    icon: TriangleAlert,
    count: "findings",
    about: "Every finding from every run, filtered by severity or searched.",
  },
  {
    href: "/policy",
    label: "Policy & approvals",
    short: "Policy",
    icon: ShieldCheck,
    about: "How the guardrails held: blocked requests and every approval decision.",
  },
  {
    href: TERMINAL_PAGE,
    label: "Terminal",
    short: "Terminal",
    icon: SquareTerminal,
    operator: true,
    about: "The Reconix terminal app in this browser tab, with the same gates (operators only).",
  },
  {
    href: "/about",
    label: "About",
    short: "About",
    icon: BookOpen,
    about: "This page: the project explained.",
  },
];

/** The pages this user can open. */
export const navPages = (terminal: boolean): NavPage[] => NAV_PAGES.filter((p) => terminal || !p.operator);
