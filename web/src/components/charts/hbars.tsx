/* Horizontal bars in recessed tracks, drawn to one scale (the largest row fills the
   track). Every row is labeled in text, and the value sits at the end in text color; the
   bar color only repeats what the label says. */
import type { Severity } from "@/lib/data/schema";
import { cn } from "@/lib/utils";

import { Dot } from "../neu/chips";

export interface BarRow {
  key: string;
  label: string;
  sub?: string;
  value: number;
  severity?: Severity;
  tip: string;
}

export function HBars({ rows, wide, label }: { rows: BarRow[]; wide?: boolean; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className={cn("hbar", wide && "wide")} title={row.tip}>
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-mono text-xs font-medium tracking-wide">
              {row.severity && <Dot severity={row.severity} />}
              <span className="truncate">{row.label}</span>
            </span>
            {row.sub && <span className="block truncate text-[11px] text-muted">{row.sub}</span>}
          </span>
          <span className="track" aria-hidden>
            {row.value > 0 && (
              <span
                className={cn(row.severity ? `fill-tone sev-${row.severity}` : "fill-tone tone-accent")}
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            )}
          </span>
          <span className="text-right font-mono text-[13px] font-semibold tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}
