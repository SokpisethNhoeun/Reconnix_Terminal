/* The dashboard's four headline tiles. Each is a whole-card link (with a chevron) into the
   page that explains it; the first turns "urgent" when critical or high findings still need
   a look. Built on the shared `.kpi` surface so it matches the rest of the dashboard. */
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4 xl:gap-[22px]">{children}</section>;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  href: string;
  badge?: ReactNode;
  urgent?: boolean;
  children?: ReactNode; // the detail line
}

export function StatCard({ label, value, href, badge, urgent, children }: StatCardProps) {
  return (
    <Link href={href} className={cn("kpi kpi-link", urgent && "kpi-urgent")} aria-label={label}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">{label}</span>
        {badge}
      </span>
      <span className="kpi-value font-display text-[30px] leading-tight font-semibold tracking-tight">{value}</span>
      {children && <span className="flex flex-wrap gap-x-2.5 gap-y-1 pr-6 text-xs text-muted">{children}</span>}
      <ChevronRight size={18} className="kpi-go" aria-hidden />
    </Link>
  );
}
