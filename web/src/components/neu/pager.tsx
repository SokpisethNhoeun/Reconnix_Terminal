/* Previous / Next for a paged list: "11–20 of 34" and two arrow links. Every list pages
   the same way, through the URL (`hrefFor`), so each page has a link and works without
   JavaScript. Nothing is shown when the whole list fits on one page. */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Page } from "@/lib/pagination";
import { cn } from "@/lib/utils";

import { buttonVariants } from "../ui/button";

interface PagerProps {
  page: Page<unknown>;
  label: string; // names the nav, e.g. "Findings pages"
  hrefFor: (page: number) => string;
  className?: string;
}

function Step({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  const look = buttonVariants({ size: "icon-sm" });
  if (!href) {
    return (
      <span className={cn(look, "pointer-events-none opacity-40")} aria-disabled="true" aria-label={label} role="link">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={look} aria-label={label} title={label} scroll={false}>
      {children}
    </Link>
  );
}

export function Pager({ page, label, hrefFor, className }: PagerProps) {
  if (page.pages <= 1) return null;
  return (
    <nav className={cn("flex items-center justify-end gap-2", className)} aria-label={label}>
      <span className="mr-1 font-mono text-[12px] text-muted tabular-nums">
        <span className="sr-only-x">
          Page {page.page} of {page.pages}:{" "}
        </span>
        {page.from}–{page.to} of {page.total}
      </span>
      <Step href={page.page > 1 ? hrefFor(page.page - 1) : null} label="Previous page">
        <ChevronLeft aria-hidden />
      </Step>
      <Step href={page.page < page.pages ? hrefFor(page.page + 1) : null} label="Next page">
        <ChevronRight aria-hidden />
      </Step>
    </nav>
  );
}
