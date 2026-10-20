/* What the Findings filters and the saved-run searches keep. Pure functions over the derived data (no I/O,
   no React), so the views and the unit tests share them. Filter values come from the address
   (`?sev=HIGH,LOW&val=review&q=sql`), so anything unknown is ignored rather than trusted. */
import type { FindingRow } from "@/components/dashboard/derive";
import type { LibraryItem } from "@/lib/data/view-types";
import { type Paging, pageOf, paginate, slicePage } from "@/lib/paging";
import { FINDING_REVIEW, RUN_STATUS } from "@/lib/status";

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

/** Validation buckets: confirmed; open and not confirmed (to review); closed by triage. */
export const VALIDATION = ["confirmed", "review", "closed"] as const;
export type Validation = (typeof VALIDATION)[number];

export const list = (value: string): string[] => value.split(",").map((v) => v.trim()).filter(Boolean);

const has = (text: string, q: string) => text.toLowerCase().includes(q);

export function validationOf(f: FindingRow): Validation {
  if (f.confirmed) return "confirmed";
  return f.needsReview ? "review" : "closed";
}

/** Why a closed finding is closed (from its triage status). */
const CLOSED_AS: Record<string, string> = { fixed: "Fixed", accepted: "Accepted", "false-positive": "False positive" };

/** A finding's review badge label: Confirmed, Needs review, or why it is closed. */
export function reviewLabel(f: FindingRow): string {
  const v = validationOf(f);
  return v === "closed" ? (CLOSED_AS[f.status] ?? FINDING_REVIEW.closed.label) : FINDING_REVIEW[v].label;
}

export interface FindingFilter {
  sev: string[]; // severities to keep (empty: all)
  val: string; // one of VALIDATION, or "" for all
  q: string;
}

/** The filter an address names: unknown severities and validation buckets are dropped. */
export function parseFindingFilter(p: { sev: string; val: string; q: string }): FindingFilter {
  return {
    sev: list(p.sev).filter((s) => (SEVERITY_ORDER as readonly string[]).includes(s)),
    val: (VALIDATION as readonly string[]).includes(p.val) ? p.val : "",
    q: p.q,
  };
}

/** Whether any filter is on (the "Clear filters" button shows). */
export const filterActive = (f: FindingFilter) => f.sev.length > 0 || f.val !== "" || f.q.trim() !== "";

export function findingMatches(f: FindingRow, { sev, val, q }: FindingFilter): boolean {
  if (sev.length && !sev.includes(f.severity)) return false;
  if ((VALIDATION as readonly string[]).includes(val) && validationOf(f) !== val) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [f.id, f.title, f.target, f.cwe, f.tool, f.category, f.run?.label ?? "", ...f.references].some((t) => has(t, needle));
}

/** Highest severity first, then the highest CVSS. */
export function sortFindings(findings: FindingRow[]): FindingRow[] {
  const rank = (s: string) => SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number]);
  return [...findings].sort((a, b) => rank(a.severity) - rank(b.severity) || (b.score ?? 0) - (a.score ?? 0));
}


/** How many items fall in each bucket, in the order the buckets are listed. */
export function countBy<T>(items: T[], key: (item: T) => string, order: readonly string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  const extra = [...counts.keys()].filter((k) => !order.includes(k)).sort();
  return [...order, ...extra].map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

/** Whether a run matches a search: its ID, template, target, time, saved status or the status
    label shown on its badge ("waiting for you", "not started"). */
export const runMatches = (item: LibraryItem, q: string) =>
  !q || [item.id, item.template, item.target, item.status, RUN_STATUS[item.status].label, item.when].some((t) => t.toLowerCase().includes(q));

// --- the page and the selection -----------------------------------------------------------
// The address names a page (`?page=2`) and maybe a finding (`?finding=F-003`). An explicit
// finding wins: the page shown is the one that holds it, so a deep link opens on its row and
// paging never drops a selection. Without one, the page's first row is selected.

export interface FindingsPage {
  paging: Paging;
  rows: FindingRow[]; // the page's rows, in order
  current: FindingRow | null; // the selected finding (null only when `sorted` is empty)
  index: number; // its index in `sorted`, or -1
  explicit: boolean; // the address named it and it is in the list
  /** The address named a finding that is not in the list: hidden by the filters, or unknown. */
  missing: "" | "filtered" | "unknown";
}

/** The page to show and the finding to select, for the filtered and sorted list. `all` is the
    unfiltered list (to tell a filtered-out finding from an unknown one). */
export function resolveFindingsPage(sorted: FindingRow[], all: FindingRow[], finding: string, page: string): FindingsPage {
  const index = finding ? sorted.findIndex((f) => f.key === finding) : -1;
  if (index >= 0) {
    const paging = paginate(sorted.length, pageOf(index));
    return { paging, rows: slicePage(sorted, paging), current: sorted[index], index, explicit: true, missing: "" };
  }
  const paging = paginate(sorted.length, page);
  const rows = slicePage(sorted, paging);
  const current = rows[0] ?? null;
  const missing = !finding ? "" : all.some((f) => f.key === finding) ? "filtered" : "unknown";
  return { paging, rows, current, index: current ? paging.start : -1, explicit: false, missing };
}

/** The address value for a page: the first page is the plain address. */
export const pageParam = (page: number) => (page > 1 ? String(page) : "");

/** What changes in the address when the pager opens `page`: the selection stays only if its row
    is on that page; otherwise the page's first row is selected (the finding is dropped). */
export function pagePatch(sorted: FindingRow[], page: number, finding: string): { page: string; finding: string } {
  const paging = paginate(sorted.length, page);
  const keep = slicePage(sorted, paging).some((f) => f.key === finding);
  return { page: pageParam(paging.page), finding: keep ? finding : "" };
}

/** What changes in the address when a filter changes: back to the first page, and the selection
    stays only while it still matches. */
export function filterPatch(all: FindingRow[], filter: FindingFilter, finding: string): { page: string; finding: string } {
  const keep = finding !== "" && all.some((f) => f.key === finding && findingMatches(f, filter));
  return { page: "", finding: keep ? finding : "" };
}

/** The finding before and after `index` in the list (across pages), or null at each end. */
export function neighbours(sorted: FindingRow[], index: number): { prev: FindingRow | null; next: FindingRow | null } {
  if (index < 0) return { prev: null, next: null };
  return { prev: sorted[index - 1] ?? null, next: sorted[index + 1] ?? null };
}
