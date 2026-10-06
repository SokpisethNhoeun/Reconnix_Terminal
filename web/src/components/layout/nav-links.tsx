"use client";

/* The sidebar links; the current section is pressed in. */
import { LayoutDashboard, List, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* `short` is the label on phones, where the four links sit side by side. */
const LINKS = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutDashboard, count: undefined },
  { href: "/assessments", label: "Assessments", short: "Assessments", icon: List, count: "assessments" },
  { href: "/findings", label: "Findings", short: "Findings", icon: TriangleAlert, count: "findings" },
  { href: "/policy", label: "Policy & approvals", short: "Policy", icon: ShieldCheck, count: undefined },
] as const;

export function NavLinks({ counts }: { counts: { assessments: number; findings: number } }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-2 max-[820px]:grid max-[820px]:grid-cols-4 max-[820px]:gap-1">
      {LINKS.map(({ href, label, short, icon: Icon, count }) => {
        const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="nav-link whitespace-nowrap" aria-current={current ? "page" : undefined}>
            <Icon size={18} aria-hidden />
            <span className="max-[820px]:hidden">{label}</span>
            <span className="min-[821px]:hidden">{short}</span>
            <span className="font-mono text-[11.5px] font-semibold text-muted max-[820px]:hidden">
              {count ? counts[count] : ""}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
