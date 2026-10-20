"use client";

/* The Assessment chip: "All assessments" (the default, the Overview totals every saved run) or
   the open run's details, a search over every saved run, and the files that were skipped (so a
   broken file is never silently missing). Opening another run keeps the current view but drops
   the selected finding (it belongs to the old run). */
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Layers, TriangleAlert } from "lucide-react";
import type { Dashboard } from "@/components/dashboard/derive";
import type { Overall } from "@/components/dashboard/derive-overall";
import { SearchField } from "@/components/dashboard/filter-bar";
import { Popover } from "@/components/dashboard/popover";
import { RunRow, runMatches } from "@/components/dashboard/run-row";
import { useRunHref } from "@/components/dashboard/view-url";
import type { LibraryItem, SkippedFile } from "@/lib/data/view-types";

export const CHIP =
  "flex h-[34px] items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:border-primary/50";

const ROW = "flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ChipTrigger({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="hidden text-muted-foreground sm:inline">{label}:</span>
      <span className="max-w-[140px] truncate text-foreground">{value}</span>
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
}

export function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="tabnums truncate text-foreground">{v}</span>
    </div>
  );
}

export type AllSummary = Pick<Overall, "runs" | "waiting" | "completed" | "findingTotal">;

export function AssessmentSwitcher({
  current,
  all,
  items,
  dir,
  skipped,
}: {
  current: Dashboard["assessment"] | null; // null: every saved run
  all: AllSummary | null;
  items: LibraryItem[];
  dir: string;
  skipped: SkippedFile[];
}) {
  const href = useRunHref();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => runMatches(i, q));
  return (
    <Popover
      triggerClassName={CHIP}
      triggerAriaLabel="Choose an assessment"
      align="start"
      panelClassName="w-[min(320px,calc(100vw-32px))] p-2 text-xs"
      triggerContent={<ChipTrigger label="Assessment" value={current ? current.id : `All (${items.length})`} />}
    >
      {(close) => (
        <>
          {current ? (
            <>
              <p className="px-1.5 pb-1.5 pt-1 text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">{current.name}</p>
              <div className="space-y-1 px-1.5 pb-2">
                <Row k="Status" v={`${current.status} · ${current.progress}%`} />
                <Row k="Started" v={current.startedAt} />
                <Row k="Duration" v={current.duration} />
                <Row k="Operator" v={current.operator} />
              </div>
            </>
          ) : (
            all && (
              <>
                <p className="px-1.5 pb-1.5 pt-1 text-[13px] font-medium text-foreground">Every saved assessment</p>
                <div className="space-y-1 px-1.5 pb-2">
                  <Row k="Assessments" v={String(all.runs)} />
                  <Row k="Completed" v={String(all.completed)} />
                  <Row k="Waiting on you" v={String(all.waiting)} />
                  <Row k="Findings" v={String(all.findingTotal)} />
                </div>
              </>
            )
          )}
          <div className="border-t border-border px-1.5 pb-1.5 pt-2">
            <p className="mb-1.5 text-muted-foreground">
              Saved assessments · <span className="font-mono text-[10px]">{dir}</span>
            </p>
            {items.length > 6 && <SearchField label="Search saved assessments" placeholder="ID, template, target, status…" value={query} onChange={setQuery} />}
          </div>
          <ul className="max-h-[260px] overflow-y-auto" data-lenis-prevent>
            {!q && (
              <li>
                <Link href={href(null)} onClick={close} aria-current={current ? undefined : "true"} className={ROW}>
                  <Layers className="size-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">All assessments</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">The Overview totals every saved run</span>
                  </span>
                  {!current && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
                </Link>
              </li>
            )}
            {shown.map((item) => {
              const on = item.uid === current?.uid;
              return (
                <li key={item.uid}>
                  <Link href={href(item.uid)} onClick={close} aria-current={on ? "true" : undefined} className={ROW}>
                    <RunRow item={item} current={on} />
                  </Link>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-1.5 py-2 text-muted-foreground">No saved assessment matches.</li>}
          </ul>
          <p className="px-1.5 pt-1.5 text-muted-foreground">
            {q ? `${shown.length} of ${items.length} shown` : `${items.length} saved ${items.length === 1 ? "assessment" : "assessments"}`}
          </p>
          {skipped.length > 0 && (
            <details className="mx-1.5 mt-2 rounded-md border border-border p-2">
              <summary className="flex cursor-pointer items-center gap-1.5 text-accent">
                <TriangleAlert className="size-3.5" aria-hidden />
                {skipped.length} {skipped.length === 1 ? "file was" : "files were"} skipped
              </summary>
              <ul className="mt-1.5 space-y-1 font-mono text-[10px] text-muted-foreground">
                {skipped.map((s) => (
                  <li key={s.file} className="[overflow-wrap:anywhere]">
                    {s.file} · {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Popover>
  );
}
