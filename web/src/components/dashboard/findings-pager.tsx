"use client";

/* The pager under the findings list: the shared Pagination (ten rows a page, lib/paging.ts),
   shown only when there is more than one page. The view turns the chosen page into an address
   change (filters.ts pagePatch keeps the selection when its row is on that page). */
import { Pagination } from "@/components/ui/pagination";
import type { Paging } from "@/lib/paging";

export function FindingsPager({ paging, onPage }: { paging: Paging; onPage: (page: number) => void }) {
  if (paging.pages <= 1) return null;
  return <Pagination paging={paging} onPage={onPage} label="Finding pages" className="dash-findings-pager" />;
}
