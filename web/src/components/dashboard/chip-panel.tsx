/* A panel of named chip groups (the Scope view's Permitted actions and Limits): each group a
   label and its chips; across runs each chip says in how many runs it appears. Anything extra
   (the time used) goes below the groups. */
import { DashCard } from "@/components/dashboard/dash-card";
import type { Chip } from "@/components/dashboard/stat-types";

export interface ChipGroup {
  label: string;
  chips: Chip[];
  empty: string;
}

export function ChipList({ label, chips }: { label: string; chips: Chip[] }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.label} title={c.title} className="dash-chip h-[26px] border border-border px-2.5 text-xs text-foreground">
          {c.label}
          {c.count !== null && (
            <span className="text-muted-foreground">
              <span aria-hidden> · </span>
              {c.count}
              <span className="sr-only">{c.count === 1 ? " run" : " runs"}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ChipPanel({
  id,
  title,
  docsHref,
  meta,
  groups,
  children,
}: {
  id: string;
  title: string;
  docsHref: string;
  meta?: string;
  groups: ChipGroup[];
  children?: React.ReactNode;
}) {
  return (
    <DashCard id={id} title={title} docsHref={docsHref} meta={meta} className="dash-panel" bodyClassName="flex flex-col gap-3.5">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="dash-subhead">{g.label}</h3>
          {g.chips.length ? <ChipList label={g.label} chips={g.chips} /> : <p className="text-xs text-muted-foreground">{g.empty}</p>}
        </div>
      ))}
      {children}
    </DashCard>
  );
}
