/* The five severity tiles at the top of the Findings page. Each is a toggle: click one to
   filter to that severity, click the lit one again to clear it. */
import Link from "next/link";

import { type Severity, SEVERITIES } from "@/lib/data/schema";
import { cn } from "@/lib/utils";

import { Dot } from "../neu/chips";

const LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  INFO: "Info",
};

interface Props {
  counts: Record<Severity, number>;
  current: string; // the selected severity, or "all"
  hrefFor: (sev: string) => string;
}

export function SeverityCards({ counts, current, hrefFor }: Props) {
  return (
    <section className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 xl:grid-cols-5" aria-label="Filter by severity">
      {SEVERITIES.map((s) => {
        const active = current === s;
        return (
          <Link
            key={s}
            href={hrefFor(active ? "all" : s)}
            aria-current={active ? "true" : undefined}
            className={cn("sev-card", `sev-${s}`)}
          >
            <span className="flex items-center gap-2.5 text-[13.5px]">
              <Dot severity={s} />
              {LABEL[s]}
            </span>
            <span className="font-display text-[22px] leading-none font-semibold tabular-nums">{counts[s]}</span>
          </Link>
        );
      })}
    </section>
  );
}
