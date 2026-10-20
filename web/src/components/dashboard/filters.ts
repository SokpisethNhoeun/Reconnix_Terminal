/* What the Findings filters keep. Pure functions over the derived data (no I/O,
   no React), so the views and the unit tests share them. Filter values come from the address
   (`?sev=HIGH,LOW&val=review&q=sql`), so anything unknown is ignored rather than trusted. */
import type { FindingRow } from "@/components/dashboard/derive";
import { FINDING_REVIEW } from "@/lib/status";

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
