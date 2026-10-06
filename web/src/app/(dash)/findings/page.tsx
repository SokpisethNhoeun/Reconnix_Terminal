/* Findings from every assessment, with severity / validation filters and search. */
import { Search } from "lucide-react";
import type { Metadata } from "next";

import { HBars } from "@/components/charts/hbars";
import { FindingDetail } from "@/components/findings/finding-detail";
import { FindingsTable } from "@/components/findings/findings-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/neu/card";
import { SegmentedLinks } from "@/components/neu/segmented";
import { Input } from "@/components/ui/input";
import { allFindings, categoryCounts, cvssSummary, isConfirmed } from "@/lib/data/stats";
import { loadLibrary } from "@/lib/data/store";
import { plural } from "@/lib/format";
import { param, query } from "@/lib/utils";

export const metadata: Metadata = { title: "Findings" };

const SEVERITY_FILTERS = [
  { id: "all", label: "All" },
  { id: "CRITICAL", label: "Critical" },
  { id: "HIGH", label: "High" },
  { id: "MEDIUM", label: "Medium" },
  { id: "LOW", label: "Low" },
  { id: "INFO", label: "Info" },
];
const VALIDATION_FILTERS = [
  { id: "all", label: "Any" },
  { id: "confirmed", label: "Confirmed" },
  { id: "review", label: "For review" },
];

export default async function FindingsPage(props: PageProps<"/findings">) {
  const sp = await props.searchParams;
  const sev = param(sp.sev) || "all";
  const val = param(sp.val) || "all";
  const q = param(sp.q).slice(0, 100);
  const { assessments } = await loadLibrary();
  const all = allFindings(assessments);
  const present = new Set(all.map((f) => f.severity));
  const text = q.trim().toLowerCase();
  const rows = all.filter(
    (f) =>
      (sev === "all" || f.severity === sev) &&
      (val === "all" || (val === "confirmed") === isConfirmed(f)) &&
      (!text || `${f.title} ${f.path} ${f.assessment.target} ${f.references.join(" ")} ${f.tool}`.toLowerCase().includes(text)),
  );
  const selected = rows.find((f) => f.key === param(sp.f)) ?? rows[0];
  const current = { sev, val, q };
  const withAssessments = new Set(all.map((f) => f.assessment.uid)).size;
  const categories = categoryCounts(all);
  const cvss = cvssSummary(all);

  return (
    <>
      <PageHeader
        title="Findings"
        sub={`${plural(all.length, "finding")} from ${plural(withAssessments, "assessment")} · ${all.filter(isConfirmed).length} confirmed`}
      />
      {all.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
          <Card title="Weakness categories" hint={plural(all.length, "finding")}>
            <HBars
              label="Findings by weakness category"
              rows={categories.map((c) => ({ key: c.name, label: c.name, value: c.count, tip: `${c.count} · ${c.name}` }))}
            />
          </Card>
          <Card title="CVSS" hint="base scores">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {[
                ["highest", cvss.max],
                ["average", cvss.avg],
                ["scored", cvss.scored],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-[30px] font-semibold leading-tight tabular-nums">
                    {label === "scored" ? value : (value as number).toFixed(1)}
                  </div>
                  <div className="text-xs text-muted">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedLinks
              label="Severity"
              items={SEVERITY_FILTERS.filter((s) => s.id === "all" || present.has(s.id as never)).map((s) => ({
                label: s.label,
                href: `/findings${query({ ...current, sev: s.id })}`,
                current: sev === s.id,
              }))}
            />
            <SegmentedLinks
              label="Validation"
              items={VALIDATION_FILTERS.map((v) => ({ label: v.label, href: `/findings${query({ ...current, val: v.id })}`, current: val === v.id }))}
            />
            <form method="get" action="/findings" className="relative">
              {sev !== "all" && <input type="hidden" name="sev" value={sev} />}
              {val !== "all" && <input type="hidden" name="val" value={val} />}
              <label htmlFor="finding-search" className="sr-only-x">
                Search findings
              </label>
              <Search
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                id="finding-search"
                name="q"
                defaultValue={q}
                placeholder="Search title, path, CWE"
                className="w-56 pl-9"
              />
            </form>
          </div>
          <FindingsTable rows={rows} selected={selected?.key} showAssessment hrefFor={(f) => `/findings${query({ ...current, f: f.key })}`} />
        </Card>
        <FindingDetail finding={selected} />
      </div>
    </>
  );
}
