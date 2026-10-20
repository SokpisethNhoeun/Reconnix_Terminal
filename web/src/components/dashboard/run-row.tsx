/* One saved run in a list (the Assessment switcher, the run picker): ID and template, then
   when, status and target; an amber dot when it waits on you, a tick when it is open. */
import { Check } from "lucide-react";
import type { LibraryItem } from "@/lib/data/view-types";

export const runMatches = (item: LibraryItem, q: string) =>
  !q || [item.id, item.template, item.target, item.status, item.when].some((t) => t.toLowerCase().includes(q));

export function RunRow({ item, current = false }: { item: LibraryItem; current?: boolean }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground">
          {item.id} · {item.template}
        </span>
        <span className="block truncate font-mono text-[10px] text-muted-foreground">
          {item.when} · {item.status} · {item.target}
        </span>
      </span>
      {item.waiting && <span aria-label="waits on you" title={item.waiting} className="size-1.5 shrink-0 rounded-full bg-accent" />}
      {current && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
    </>
  );
}
