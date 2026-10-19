/* The dashboard's pages, in sidebar order: the sidebar (NavLinks) and the Documentation
   page's "Where to look" list are both built from this. Plain data, so server and client
   code can import it. `operator` pages are only listed for operators; a `bottom` page is
   pinned to the foot of the sidebar (Settings). */
import {
  BookOpen,
  LayoutDashboard,
  List,
  type LucideIcon,
  Settings,
  Sparkles,
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
  bottom?: boolean; // pinned to the foot of the sidebar
  about: string; // one line for the Documentation page
}

export const NAV_PAGES: NavPage[] = [
  {
    href: "/",
    label: "Dashboard",
    short: "Dashboard",
    icon: LayoutDashboard,
    about: "Counts and charts across every saved assessment, and what waits for you.",
  },
  {
    href: TERMINAL_PAGE,
    label: "AI Assistant",
    short: "AI",
    icon: Sparkles,
    operator: true,
    about: "Run and talk to Reconix in this browser tab, with the same gates (operators only).",
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
    href: "/about",
    label: "Documentation",
    short: "Docs",
    icon: BookOpen,
    about: "This page: the project explained, the safety gates, and how the pieces fit.",
  },
  {
    href: "/settings",
    label: "Settings",
    short: "Settings",
    icon: Settings,
    bottom: true,
    about: "The theme, where the data is read from, and the role you are signed in with.",
  },
];

/** The pages this user can open. */
export const navPages = (terminal: boolean): NavPage[] => NAV_PAGES.filter((p) => terminal || !p.operator);
