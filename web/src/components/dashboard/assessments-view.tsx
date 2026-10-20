"use client";

/* The Assessments view: every saved run, newest first; a row opens that run's Overview. This is
   the Phase 0 stub (docs/WEB_REDESIGN_V3_PLAN.md): the Assessments workstream replaces it with
   search, status and template filters and ten rows a page (lib/paging.ts, ui/pagination.tsx). */
import Link from "next/link";

import { RunRow } from "@/components/dashboard/run-row";
import type { LibraryItem } from "@/lib/data/view-types";

export function AssessmentsView({ items }: { items: LibraryItem[] }) {
  return (
    <div className="dash-view dash-sheet">
      <header>
        <h1 className="text-[20px] font-medium text-foreground">Assessments</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {items.length === 1 ? "1 saved run" : `${items.length} saved runs`} · open one to see its overview.
        </p>
      </header>
      <ul aria-label="Saved assessments" className="grid gap-2 text-xs sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.uid}>
            <Link href={`/?uid=${encodeURIComponent(item.uid)}`} className="dash-finding-row flex items-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RunRow item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
