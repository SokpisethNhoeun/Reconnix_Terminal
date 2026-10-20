"use client";

/* Every saved run as a row of the Report view (newest first): the run (it opens that run's
   report), target, status, findings with the worst severity, plan steps, and its PDF and HTML
   reports to download. A search narrows the rows by ID, template, target or status; ten rows
   show at a time. With a `selection`, each row gets a checkbox to put the run in the combined
   report (report-selection.tsx owns which are chosen); once the most are chosen, the others are
   disabled and say why. */
import { useState } from "react";

import { DashCard } from "@/components/dashboard/dash-card";
import { SearchField } from "@/components/dashboard/filter-bar";
import { runMatches } from "@/components/dashboard/filters";
import type { ReportRunRow } from "@/components/dashboard/report-types";
import { RunLinkTo } from "@/components/dashboard/run-link";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { paginate, slicePage } from "@/lib/paging";
import { downloadHref, exportSpec } from "@/lib/report/formats";
import { RUN_STATUS } from "@/lib/status";

const SEARCH_FROM = 7; // runs before a search field is worth it
const QUICK = ["pdf", "html"] as const; // the other formats are on the run's own report

export interface RunSelection {
  chosen: ReadonlySet<string>; // uids
  max: number;
  onToggle: (uid: string) => void;
}

export function ReportRuns({ runs, selection }: { runs: ReportRunRow[]; selection?: RunSelection }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const q = query.trim().toLowerCase();
  const shown = runs.filter((r) => runMatches(r, q));
  const paging = paginate(shown.length, page);
  const rows = slicePage(shown, paging);
  const full = selection ? selection.chosen.size >= selection.max : false;
  return (
    <DashCard
      id="report-runs"
      title="Runs"
      docsHref="/docs/reference/reports"
      meta={shown.length === runs.length ? `${runs.length} saved` : `${shown.length} of ${runs.length}`}
      className="is-wide"
      bodyClassName="flex flex-col gap-3"
    >
      {runs.length >= SEARCH_FROM && (
        <div className="w-full sm:w-[280px]">
          <SearchField
            label="Search saved assessments"
            placeholder="ID, template, target, status…"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
          />
        </div>
      )}
      <div className="dash-table-scroll">
        <table aria-label="Saved assessments" className="dash-table">
          <thead>
            <tr>
              {selection && (
                <th scope="col">
                  <span className="sr-only">Combine</span>
                </th>
              )}
              <th scope="col">Run</th>
              <th scope="col">Target</th>
              <th scope="col">Status</th>
              <th scope="col">Findings</th>
              <th scope="col" className="text-right">Plan</th>
              <th scope="col">Download</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const picked = selection?.chosen.has(r.uid) ?? false;
              return (
                <tr key={r.uid} data-selected={picked || undefined}>
                  {selection && (
                    <td className="w-6">
                      <Checkbox
                        label={<span className="sr-only">{`Combine ${r.id} (${r.template}, ${r.when})`}</span>}
                        checked={picked}
                        disabled={!picked && full}
                        reason={`${selection.max} already selected`}
                        onChange={() => selection.onToggle(r.uid)}
                        className="rep-pick"
                      />
                    </td>
                  )}
                  <th scope="row" className="font-normal">
                    <RunLinkTo uid={r.uid} label={`Open the report of ${r.id} (${r.template}, ${r.when})`} className="block text-foreground hover:text-primary">
                      <span className="block whitespace-nowrap">
                        {r.id} · {r.template}
                      </span>
                      <span className="block whitespace-nowrap font-mono text-[10px] text-muted-foreground">{r.when}</span>
                    </RunLinkTo>
                  </th>
                  <td className="max-w-[220px] font-mono text-muted-foreground [overflow-wrap:anywhere]">{r.target}</td>
                  <td title={r.waiting || undefined}>
                    <StatusBadge meaning={RUN_STATUS[r.status]} />
                  </td>
                  <td>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="w-5 text-right tabnums text-foreground">{r.findings}</span>
                      {r.worst && <SeverityBadge level={r.worst} />}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-right font-mono tabnums text-muted-foreground">
                    {r.steps.done}/{r.steps.total}
                  </td>
                  <td>
                    <span className="flex gap-1.5">
                      {QUICK.map((id) => (
                        <a
                          key={id}
                          href={downloadHref(r.uid, id)}
                          download
                          aria-label={`Download the ${exportSpec(id).title} of ${r.id} (${r.when})`}
                          title={exportSpec(id).blurb}
                          className="dash-chip h-[24px] border border-border px-2 text-[11px] text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {exportSpec(id).label}
                        </a>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No saved assessment matches.</p>}
      {paging.pages > 1 && <Pagination paging={paging} onPage={setPage} label="Saved assessment pages" />}
    </DashCard>
  );
}
