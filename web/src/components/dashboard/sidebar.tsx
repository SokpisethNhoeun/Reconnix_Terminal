"use client";

import Link from "next/link";
import {
  BookOpen,
  FileText,
  Layers,
  LayoutGrid,
  Settings,
  Sparkles,
  Target,
  TerminalSquare,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { View } from "@/components/dashboard/view-url";

type NavItem = { icon: LucideIcon; label: string; view: View };
type DocItem = { icon: LucideIcon; label: string; href: string };

const VIEWS: NavItem[] = [
  { icon: LayoutGrid, label: "Overview", view: "overview" },
  { icon: Sparkles, label: "AI Assistant", view: "assistant" },
  { icon: Layers, label: "Assessments", view: "assessments" },
  { icon: TriangleAlert, label: "Findings", view: "findings" },
  { icon: FileText, label: "Reports", view: "reports" },
  { icon: Target, label: "Scope", view: "scope" },
  { icon: TerminalSquare, label: "Terminal", view: "terminal" },
];
// The Terminal item always opens its view; when this browser can't use the terminal, the
// view says why (no dead ends), and the tooltip says so up front.
const TERMINAL_HINT = { operator: "Terminal", viewer: "Terminal · operator role needed", off: "Terminal · off" } as const;
const DOCS: DocItem[] = [
  { icon: BookOpen, label: "Documentation", href: "/docs" },
  { icon: Settings, label: "Configuration", href: "/docs/getting-started/configuration" },
];

// Logo: a 3×3 grid of rounded teal squares, 4 of the 9 dimmed (like the reference mark).
const DIM = new Set([1, 3, 5, 7]);

function Logo() {
  return (
    <span aria-hidden className="grid size-7 grid-cols-3 gap-[2px]">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="rounded-[2px] bg-primary" style={{ opacity: DIM.has(i) ? 0.35 : 1 }} />
      ))}
    </span>
  );
}

export function Sidebar({
  active,
  onSelect,
  terminalState,
}: {
  active: View;
  onSelect: (v: View) => void;
  terminalState: keyof typeof TERMINAL_HINT;
}) {
  return (
    <aside className="dash-sidebar flex items-center border-border">
      <Link href="/" aria-label="Reconix local assessment viewer" className="grid h-16 w-full place-items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo />
      </Link>
      <nav aria-label="Views" className="flex flex-1 flex-col items-center gap-2 py-3">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          const label = item.view === "terminal" ? TERMINAL_HINT[terminalState] : item.label;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onSelect(item.view)}
              data-view={item.view}
              // the active marker (.dash-navbtn::after, motion.css) slides in once on this
              // attribute: no loop, nothing on the icon or the label
              data-active={active === item.view ? "true" : undefined}
              aria-current={active === item.view ? "page" : undefined}
              aria-label={label}
              className="dash-navbtn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.view === "assistant" ? (
                // breathes with the open assistant (breath.ts); only the icon scales, the button
                // and its click area stay put
                <span className="dash-ai-icon" data-breath="scale" aria-hidden>
                  <span className="dash-ai-halo" data-breath="glow" />
                  <Icon className="size-[18px]" strokeWidth={1.6} />
                </span>
              ) : (
                <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
              )}
              <span role="tooltip" className="dash-tip">
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="flex flex-col items-center gap-2 pb-3">
        {DOCS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="dash-navbtn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
              <span role="tooltip" className="dash-tip">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
