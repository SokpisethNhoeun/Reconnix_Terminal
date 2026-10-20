"use client";

/* Every saved run as a row of the Report view (newest first): the run (it opens that run's
   report), target, status, findings with the worst severity, plan steps, and its PDF and HTML
   reports to download. A search narrows the rows by ID, template, target or status. */
import { useState } from "react";

import { DashCard } from "@/components/dashboard/dash-card";
import { SearchField } from "@/components/dashboard/filter-bar";
import { runMatches } from "@/components/dashboard/filters";
import type { ReportRunRow } from "@/components/dashboard/report-types";
import { RunLinkTo } from "@/components/dashboard/run-link";
import { SeverityBadge, StatusBadge } from "@/components/ui/status-badge";
import { downloadHref, exportSpec } from "@/lib/report/formats";
import { RUN_STATUS } from "@/lib/status";

const SEARCH_FROM = 7; // runs before a search field is worth it
const QUICK = ["pdf", "html"] as const; // the other formats are on the run's own report

export function ReportRuns({ runs }: { runs: ReportRunRow[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = runs.filter((r) => runMatches(r, q));
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
          <SearchField label="Search saved assessments" placeholder="ID, template, target, status…" value={query} onChange={setQuery} />
        </div>
      )}
      <div className="dash-table-scroll">
        <table aria-label="Saved assessments" className="dash-table">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Target</th>
              <th scope="col">Status</th>
              <th scope="col">Findings</th>
              <th scope="col" className="text-right">Plan</th>
              <th scope="col">Download</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.uid}>
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
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No saved assessment matches.</p>}
    </DashCard>
  );
}
