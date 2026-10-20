/* A chart's time axis: tick labels placed at their positions (0–1), the first and last kept
   inside the chart. HTML, so the text is never stretched with the plot. */
import type { Marker } from "@/components/dashboard/overview-types";
import { cn } from "@/lib/utils";

export function Axis({ ticks, className }: { ticks: Marker[]; className?: string }) {
  if (!ticks.length) return null;
  return (
    <div aria-hidden className={cn("dash-axis", className)}>
      {ticks.map((t) => (
        <span key={t.pos} data-edge={t.pos <= 0.02 ? "start" : t.pos >= 0.98 ? "end" : undefined} style={{ left: `${t.pos * 100}%` }}>
          {t.label}
        </span>
      ))}
    </div>
  );
}
