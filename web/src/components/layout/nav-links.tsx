"use client";

/* The sidebar links; the current section is pressed in. Terminal only for operators. */
import { LayoutDashboard, List, ShieldCheck, SquareTerminal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TERMINAL_PAGE } from "@/lib/terminal/paths";
import { cn } from "@/lib/utils";

/* `short` is the label on phones, where the links sit side by side. */
const LINKS = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutDashboard, count: undefined },
  { href: "/assessments", label: "Assessments", short: "Assessments", icon: List, count: "assessments" },
  { href: "/findings", label: "Findings", short: "Findings", icon: TriangleAlert, count: "findings" },
  { href: "/policy", label: "Policy & approvals", short: "Policy", icon: ShieldCheck, count: undefined },
] as const;
const TERMINAL = { href: TERMINAL_PAGE, label: "Terminal", short: "Terminal", icon: SquareTerminal, count: undefined } as const;

interface NavLinksProps {
  counts: { assessments: number; findings: number };
  terminal: boolean;
}

export function NavLinks({ counts, terminal }: NavLinksProps) {
  const pathname = usePathname();
  const links = terminal ? [...LINKS, TERMINAL] : LINKS;
  return (
    <nav
      aria-label="Main"
      className={cn("flex flex-col gap-2 max-[820px]:grid max-[820px]:gap-1", terminal ? "max-[820px]:grid-cols-5" : "max-[820px]:grid-cols-4")}
    >
      {links.map(({ href, label, short, icon: Icon, count }) => {
        const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="nav-link min-w-0 whitespace-nowrap" aria-current={current ? "page" : undefined}>
            <Icon size={18} aria-hidden />
            <span className="max-[820px]:hidden">{label}</span>
            <span className="max-w-full truncate min-[821px]:hidden">{short}</span>
            <span className="font-mono text-[11.5px] font-semibold text-muted max-[820px]:hidden">
              {count ? counts[count] : ""}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
