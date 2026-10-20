/* A chart's legend: each swatch next to its name, with what it means as the tooltip (never
   colour alone). The shapes match the marks the charts draw. */
import type { LegendItem } from "@/components/dashboard/overview-types";
import { cn } from "@/lib/utils";

function Swatch({ item }: { item: LegendItem }) {
  const style = { "--c": item.color } as React.CSSProperties;
  return <span aria-hidden className="dash-swatch" data-shape={item.shape} style={style} />;
}

export function Legend({ items, label, className }: { items: LegendItem[]; label: string; className?: string }) {
  if (!items.length) return null;
  return (
    <ul aria-label={label} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground", className)}>
      {items.map((item) => (
        <li key={item.label} title={item.hint} className="inline-flex items-center gap-1.5">
          <Swatch item={item} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
