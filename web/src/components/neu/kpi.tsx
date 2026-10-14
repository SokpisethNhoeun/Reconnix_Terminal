/* Stat tiles: a label, one number, and an optional line of detail. */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface KpiProps {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

export function Kpi({ label, value, children, compact }: KpiProps) {
  return (
    <div className={cn("kpi", compact && "px-4 py-3.5")}>
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={cn("font-display font-semibold tabular-nums tracking-tight", compact ? "text-2xl" : "text-[30px] leading-tight")}>
        {value}
      </span>
      {children && <span className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted">{children}</span>}
    </div>
  );
}

/** Tiles in a row: five across on wide screens, or six (`cols={6}`) for a longer row. */
export function KpiGrid({ children, cols = 5 }: { children: ReactNode; cols?: 5 | 6 }) {
  return (
    <section className={cn("grid grid-cols-2 gap-[18px] md:grid-cols-3 xl:gap-[22px]", cols === 6 ? "xl:grid-cols-6" : "xl:grid-cols-5")}>
      {children}
    </section>
  );
}

/** One "● 4 completed" item inside a tile's detail line. */
export function KpiNote({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}
