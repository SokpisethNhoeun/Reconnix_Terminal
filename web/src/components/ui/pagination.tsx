"use client";

/* Previous / Next paging for a list of 10 rows at a time (lib/paging.ts): the page and the
   count in words between the two buttons, each disabled at its end with a reason. The view owns
   the page (in the address) and hands it back through `onPage`. */
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Paging } from "@/lib/paging";
import { cn } from "@/lib/utils";

export function Pagination({ paging, onPage, label = "Pages", className }: { paging: Paging; onPage: (page: number) => void; label?: string; className?: string }) {
  const { page, pages } = paging;
  const first = page <= 1;
  const last = page >= pages;
  return (
    <nav aria-label={label} className={cn("ui-pager", className)}>
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={first}
        aria-label="Previous page"
        title={first ? "This is the first page" : "Previous page"}
        className="ui-pager-btn"
      >
        <ChevronLeft className="size-3.5" aria-hidden /> Previous
      </button>
      <span className="ui-pager-label tabnums" aria-live="polite">
        {paging.label}
      </span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={last} aria-label="Next page" title={last ? "This is the last page" : "Next page"} className="ui-pager-btn">
        Next <ChevronRight className="size-3.5" aria-hidden />
      </button>
    </nav>
  );
}
