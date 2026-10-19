/* Findings from every assessment: severity tiles that double as filters, a status filter and
   search, then the table, 10 to a page. Each row opens the finding's own page. Severity is
   the analyst's when set; "Need review" means open and not confirmed, as on the dashboard. */
import { Search } from "lucide-react";
import type { Metadata } from "next";

import { FindingsTable } from "@/components/findings/findings-table";
import { SeverityCards } from "@/components/findings/severity-cards";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { Pager } from "@/components/neu/pager";
import { SegmentedLinks } from "@/components/neu/segmented";
import { Input } from "@/components/ui/input";
import { allFindings, effectiveSeverity, isConfirmed, isFalsePositive, needsReview, severityCounts } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { plural } from "@/lib/format";
import { pageNumber, pageParam, paginate } from "@/lib/pagination";
import { param, query } from "@/lib/utils";

export const metadata: Metadata = { title: "Findings" };

type View = "all" | "review" | "confirmed" | "false-positive" | "fixed";

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "Need review" },
  { id: "confirmed", label: "Confirmed" },
  { id: "false-positive", label: "False positive" },
  { id: "fixed", label: "Fixed" },
];

const matchesView = (f: Parameters<typeof isConfirmed>[0], view: View): boolean => {
  if (view === "review") return needsReview(f);
  if (view === "confirmed") return isConfirmed(f);
  if (view === "false-positive") return isFalsePositive(f);
  if (view === "fixed") return f.status === "fixed";
  return true;
};

export default async function FindingsPage(props: PageProps<"/findings">) {
  const sp = await props.searchParams;
  const sev = param(sp.sev) || "all";
  const view = (VIEWS.some((v) => v.id === param(sp.view)) ? param(sp.view) : "all") as View;
  const q = param(sp.q).slice(0, 100);
  const { assessments } = await loadLibrary();
  const all = allFindings(assessments);
  const text = q.trim().toLowerCase();
  const rows = all.filter(
    (f) =>
      (sev === "all" || effectiveSeverity(f) === sev) &&
      matchesView(f, view) &&
      (!text || `${f.title} ${f.path} ${f.assessment.target} ${f.assessment.label} ${f.references.join(" ")} ${f.tool}`.toLowerCase().includes(text)),
  );
  const page = paginate(rows, pageNumber(param(sp.page)));
  const current = { sev, view, q };

  const withAssessments = new Set(all.map((f) => f.assessment.uid)).size;
  const real = all.filter((f) => !isFalsePositive(f));
  const confirmed = all.filter(isConfirmed).length;
  const review = all.filter(needsReview).length;
  const viewCount = (v: View) => all.filter((f) => matchesView(f, v)).length;

  return (
    <>
      <PageHeader
        title="Findings"
        sub={`${plural(real.length, "finding")} from ${plural(withAssessments, "assessment")} · ${confirmed} confirmed · ${review} need review · most severe first`}
      />

      {all.length > 0 && (
        <SeverityCards counts={severityCounts(all)} current={sev} hrefFor={(s) => `/findings${query({ ...current, sev: s, page: undefined })}`} />
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <form method="get" action="/findings" className="relative grow sm:max-w-sm">
            {sev !== "all" && <input type="hidden" name="sev" value={sev} />}
            {view !== "all" && <input type="hidden" name="view" value={view} />}
            <label htmlFor="finding-search" className="sr-only-x">
              Search findings
            </label>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input id="finding-search" name="q" defaultValue={q} placeholder="Search title, target, CWE or CVE" className="pl-9" />
          </form>
          <SegmentedLinks
            label="Status"
            items={VIEWS.map((v) => ({
              label: `${v.label} ${viewCount(v.id)}`,
              href: `/findings${query({ ...current, view: v.id, page: undefined })}`,
              current: view === v.id,
            }))}
          />
        </div>
        <FindingsTable rows={page.items} />
        <Pager page={page} label="Finding pages" hrefFor={(n) => `/findings${query({ ...current, page: pageParam(n) })}`} />
        <p className="text-[12.5px] text-muted">
          Showing {page.items.length} of {plural(rows.length, "finding")} · click a row to open the finding details · duplicates are merged into one finding
        </p>
      </Card>
    </>
  );
}
