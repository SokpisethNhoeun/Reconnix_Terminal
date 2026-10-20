"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { FindingRow } from "@/components/dashboard/derive";
import { FilterChips, FilterSummary, SearchField } from "@/components/dashboard/filter-bar";
import { FindingDetail } from "@/components/dashboard/finding-detail";
import { FindingsList } from "@/components/dashboard/findings-list";
import {
  SEVERITY_ORDER,
  VALIDATION,
  countBy,
  filterActive,
  filterPatch,
  findingMatches,
  neighbours,
  pagePatch,
  parseFindingFilter,
  resolveFindingsPage,
  sortFindings,
  validationOf,
} from "@/components/dashboard/filters";
import { useQueryParams } from "@/components/dashboard/view-url";
import { ListDetail } from "@/components/ui/list-detail";
import type { Severity } from "@/lib/data/view-types";
import { FINDING_REVIEW, SEVERITY_META, toneColor } from "@/lib/status";

const KEYS = ["sev", "val", "q", "finding", "page"] as const;
const NARROW = "(max-width: 1023.98px)"; // one pane at a time (components/ui/list-detail.tsx)
const LINK = "rounded-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const NOTICE_BTN = "rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Adds a history entry that names the finding (a phone's detail pane: Back returns to the list). */
function pushFinding(key: string): void {
  const params = new URLSearchParams(window.location.search);
  params.set("finding", key);
  window.history.pushState(null, "", `?${params.toString()}`);
}

/**
 * Findings: search and filter chips (severity, validation) over a list of ten rows a page, and
 * the selected finding's evidence and remediation beside it. Filters, the page and the
 * selection live in the address (`?sev=HIGH,LOW&val=review&q=sql&page=2&finding=F-001`), so
 * the Overview can drill into them and a link opens on its finding's page. With `across` set
 * the list holds every saved run's findings: each row names its run, and the selection is the
 * row's key (`<uid>~F-001`). The rules (which page, which row) are pure, in filters.ts.
 */
export function FindingsView({ findings, across = null }: { findings: FindingRow[]; across?: number | null }) {
  const [p, update] = useQueryParams(KEYS);
  const detail = useRef<HTMLElement>(null);
  const pushed = useRef(false); // this page pushed the entry the phone's detail pane sits on

  const filter = parseFindingFilter(p);
  const active = filterActive(filter);
  const sorted = sortFindings(findings.filter((f) => findingMatches(f, filter)));
  const page = resolveFindingsPage(sorted, findings, p.finding, p.page);
  const { prev, next } = neighbours(sorted, page.index);
  const pane = page.explicit ? "detail" : "list";

  // A row: on a phone or tablet the detail pane replaces the list, as a history entry.
  const open = (key: string) => {
    if (!window.matchMedia(NARROW).matches) return update({ finding: key });
    pushFinding(key);
    pushed.current = true;
  };
  const back = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    update({ finding: "" }); // a link or a reload opened the detail: nothing to go back to
  };
  useEffect(() => {
    const onPop = () => (pushed.current = false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // The phone's detail pane starts at its top (the list may have been scrolled far down). The
  // window scrolls there (never scrollIntoView: it would move where the keyboard's Tab starts).
  useEffect(() => {
    const top = detail.current?.getBoundingClientRect().top;
    if (pane !== "detail" || top === undefined || !window.matchMedia(NARROW).matches) return;
    const margin = 12; // the content area's scroll padding
    if (top < 0 || top > margin) window.scrollTo({ top: Math.max(0, window.scrollY + top - margin), behavior: "instant" });
  }, [pane, page.current?.key]);

  const setFilter = (patch: Partial<Record<"sev" | "val" | "q", string>>) => {
    const nextFilter = parseFindingFilter({ ...p, ...patch });
    update({ ...patch, ...filterPatch(findings, nextFilter, p.finding) });
  };
  const clearFilters = () => setFilter({ sev: "", val: "", q: "" });

  const sevChips = countBy(findings, (f) => f.severity, SEVERITY_ORDER)
    .filter((c) => c.count > 0 || filter.sev.includes(c.value))
    .map((c) => ({ ...c, label: c.value.toLowerCase(), color: SEVERITY_META[c.value as Severity]?.color }));
  const valChips = countBy(findings, validationOf, VALIDATION).map((c) => {
    const meaning = FINDING_REVIEW[c.value as keyof typeof FINDING_REVIEW];
    return { ...c, label: meaning?.label ?? c.value, color: meaning ? toneColor(meaning.tone) : undefined, hint: meaning?.hint };
  });

  return (
    <div className="dash-view dash-findings" data-pane={pane}>
      <header className="mb-3">
        <h1 className="text-[20px] font-medium text-foreground">Findings</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {findings.length
            ? `${findings.length} ${findings.length === 1 ? "finding" : "findings"}${across !== null ? ` across ${across} ${across === 1 ? "assessment" : "assessments"}` : ""} · select one to see its evidence and remediation.`
            : across !== null
              ? "No findings in any saved assessment yet."
              : "No findings in this assessment yet."}
        </p>
      </header>

      {findings.length > 0 && (
        <div className="dash-findings-filters mb-4 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="w-full sm:w-[260px]">
              <SearchField label="Search findings" placeholder="Search title, ID, CWE, target…" value={p.q} onChange={(q) => setFilter({ q })} />
            </div>
            <FilterChips label="Severity" multi options={sevChips} selected={filter.sev} onChange={(next) => setFilter({ sev: next.join(",") })} />
            <FilterChips
              label="Validation"
              options={valChips}
              selected={filter.val ? [filter.val] : []}
              onChange={([next]) => setFilter({ val: next === p.val ? "" : next })}
            />
          </div>
          <FilterSummary shown={sorted.length} total={findings.length} noun="findings" active={active} onClear={clearFilters} />
        </div>
      )}

      {findings.length === 0 && (
        <p className="dash-findings-empty rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {across !== null
            ? "Findings appear here once a saved assessment records some."
            : "Findings appear here once this assessment's run records some. The Overview shows how far the run has come."}
        </p>
      )}

      {findings.length > 0 && sorted.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No finding matches these filters.</p>
      )}

      {page.missing && (
        <p role="status" className="dash-findings-notice mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 break-all">
            {page.missing === "filtered" ? (
              <>
                <span className="font-mono text-foreground">{p.finding}</span> is hidden by the filters.
              </>
            ) : (
              <>
                No finding <span className="font-mono text-foreground">{p.finding.slice(0, 48)}</span> in {across !== null ? "the saved assessments" : "this assessment"}.
              </>
            )}
          </span>
          {page.missing === "filtered" && (
            <button type="button" onClick={() => update({ sev: "", val: "", q: "", page: "" })} className={NOTICE_BTN}>
              Show it
            </button>
          )}
          <button type="button" onClick={() => update({ finding: "" })} className={NOTICE_BTN}>
            Dismiss
          </button>
        </p>
      )}

      {page.current && (
        <ListDetail
          pane={pane}
          onBack={back}
          backLabel="Back to the findings"
          listLabel="Findings list"
          list={
            <FindingsList rows={page.rows} currentKey={page.current.key} paging={page.paging} onOpen={open} onPage={(n) => update(pagePatch(sorted, n, p.finding))} />
          }
          detail={
            <FindingDetail
              ref={detail}
              finding={page.current}
              position={{ index: page.index, total: sorted.length }}
              prev={prev}
              next={next}
              onSelect={(key) => update({ finding: key, page: "" })}
            />
          }
        />
      )}

      <p className="dash-findings-foot mt-4 text-xs text-muted-foreground">
        See{" "}
        <Link href="/docs/reference/findings" className={LINK}>
          the findings format
        </Link>{" "}
        for how severity, validation and evidence are recorded.
      </p>
    </div>
  );
}
