"use client";

/* The sidebar links; the current section is lit teal. The AI Assistant is only for
   operators. `slot="bottom"` renders the pinned pages (Settings) at the foot. */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { navPages } from "./nav-data";

interface NavLinksProps {
  counts: { assessments: number; findings: number };
  terminal: boolean;
  slot?: "main" | "bottom";
}

export function NavLinks({ counts, terminal, slot = "main" }: NavLinksProps) {
  const pathname = usePathname();
  const links = navPages(terminal).filter((p) => (slot === "bottom" ? p.bottom : !p.bottom));
  return (
    <nav
      aria-label={slot === "bottom" ? "Settings" : "Main"}
      className={cn(
        "flex flex-col gap-1 max-[820px]:grid max-[820px]:gap-1",
        // phones: one row of five, or two rows of three
        links.length > 5 ? "max-[820px]:grid-cols-3" : "max-[820px]:grid-cols-5",
      )}
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
