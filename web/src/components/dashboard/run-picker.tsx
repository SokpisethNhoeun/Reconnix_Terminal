"use client";

/* Shown by the views that belong to one run (Reports, Scope) while the Overview
   totals every saved run: pick a run to open the view for it (the view stays open). */
import { useState } from "react";
import Link from "next/link";
import { SearchField } from "@/components/dashboard/filter-bar";
import { RunRow, runMatches } from "@/components/dashboard/run-row";
import { useRunHref } from "@/components/dashboard/view-url";
import type { LibraryItem } from "@/lib/data/view-types";

export function RunPicker({ title, about, items }: { title: string; about: string; items: LibraryItem[] }) {
  const href = useRunHref();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => runMatches(i, q));
  return (
    <div className="dash-view max-w-4xl">
      <header className="mb-3">
        <h1 className="text-[20px] font-medium text-foreground">{title}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{about}</p>
      </header>
      {items.length > 6 && (
        <div className="mb-3 w-full sm:w-[280px]">
          <SearchField label="Search saved assessments" placeholder="ID, template, target, status…" value={query} onChange={setQuery} />
        </div>
      )}
      <ul aria-label="Saved assessments" className="grid gap-2 text-xs sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.uid}>
            <Link
              href={href(item.uid)}
              className="dash-finding-row flex items-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RunRow item={item} />
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No saved assessment matches.</p>}
    </div>
  );
}
