"use client";

/* The Assessments view: every saved run, newest first, ten to a page. A search and the status and
   template chips narrow the rows (assessments-filters.ts); the values and the page live in the
   address (`?view=assessments&q=api&status=Completed&template=API&page=2`), so a reload or a link
   lands on the same rows. A row opens that run's Overview. The page shows EmptyView instead when
   nothing is saved; here the rows are never empty, only the match can be. */
import { useRef } from "react";

import { AssessmentsFilters } from "@/components/dashboard/assessments-filters-bar";
import { ASSESSMENT_KEYS, filterRuns, parseRunFilter, runFilterActive } from "@/components/dashboard/assessments-filters";
import { AssessmentsRows } from "@/components/dashboard/assessments-rows";
import { plural } from "@/components/dashboard/derive-shared";
import type { ReportRunRow } from "@/components/dashboard/report-types";
import { ViewHeader } from "@/components/dashboard/view-header";
import { useQueryParams } from "@/components/dashboard/view-url";
import { Pagination } from "@/components/ui/pagination";
import { paginate, slicePage } from "@/lib/paging";


export function AssessmentsView({ rows }: { rows: ReportRunRow[] }) {
  const [p, update] = useQueryParams(ASSESSMENT_KEYS);
  const top = useRef<HTMLDivElement>(null);
  const filter = parseRunFilter(p, rows);
  const active = runFilterActive(filter);
  const shown = filterRuns(rows, filter);
  const paging = paginate(shown.length, p.page);
  const page = slicePage(shown, paging);

  const turn = (n: number) => update({ page: n > 1 ? String(n) : "" });

  return (
    <div className="dash-view dash-sheet" ref={top}>
      <ViewHeader
        title="Assessments"
        tag={`All ${plural(rows.length, "run")}`}
        about={
          rows.length === 1
            ? "The one run the TUI saved: open it for its overview, findings, scope and report."
            : "Every run the TUI saved, newest first: search or filter them, and open one for its overview, findings, scope and report."
        }
      />

      <AssessmentsFilters rows={rows} filter={filter} active={active} shown={shown.length} onChange={(patch) => update({ ...patch, page: "" })} />

      {shown.length === 0 ? (
        <p className="asm-empty" role="status">
          No saved run matches these filters.
        </p>
      ) : (
        <>
          <AssessmentsRows rows={page} />
          <Pagination paging={paging} onPage={turn} label="Assessment pages" scrollTarget={top} />
        </>
      )}
    </div>
  );
}
