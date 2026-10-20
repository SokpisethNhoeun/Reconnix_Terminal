import type { StatCard } from "@/components/dashboard/derive";
import { ViewLink } from "@/components/dashboard/view-link";

// Bottom-left 2×2 stat cards (§5.11). Label top-left, big number bottom-left, tone chip
// bottom-right (data-countup marks the count-up targets). A card with a drill-down is one
// big button over the card that opens the matching view (see derive.ts `link`).
export function StatCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-2.5">
      {cards.map((c) => (
        <div key={c.label} className="dash-card flex min-h-0 flex-col justify-between gap-2">
          <span className="text-xs text-muted-foreground">{c.label}</span>
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <span
              key={c.value}
              className="whitespace-nowrap text-[30px] leading-none tabnums"
              data-countup
              data-count-format={c.isDuration ? "duration" : "int"}
            >
              {c.value}
            </span>
            <span
              className="dash-chip h-[22px] px-2 text-[10px]"
              style={{
                background: `color-mix(in oklab, var(--${c.tone}) 12%, transparent)`,
                color: `var(--${c.tone})`,
              }}
            >
              {c.chip}
            </span>
          </div>
          {c.link && (
            <ViewLink view={c.link.view} filters={c.link.filters} label={c.link.label} className="absolute inset-0 z-[1] rounded-[14px]">
              <span className="sr-only">{c.link.label}</span>
            </ViewLink>
          )}
        </div>
      ))}
    </div>
  );
}
