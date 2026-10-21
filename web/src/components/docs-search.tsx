"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { DocsSearchEntry } from "@/lib/docs-search-index";
import { cn } from "@/lib/utils";

type Hit = { entry: DocsSearchEntry; href: string; heading?: string; score: number };

const normalise = (s: string) => s.trim().toLowerCase();

/** Rank one page against the query: the title first, then a command alias, a heading, the description. */
function match(entry: DocsSearchEntry, q: string): Hit | null {
  const title = entry.title.toLowerCase();
  const bare = q.replace(/^\//, "");
  if (title === q || title === `/${bare}`) return { entry, href: entry.href, score: 100 };
  if (title.startsWith(q) || title.replace(/^\//, "").startsWith(bare)) return { entry, href: entry.href, score: 80 };
  if (entry.keywords.some((k) => k.toLowerCase().startsWith(q) || k.toLowerCase().replace(/^\//, "").startsWith(bare))) {
    return { entry, href: entry.href, score: 70 };
  }
  if (title.includes(q)) return { entry, href: entry.href, score: 60 };
  const heading = entry.headings.find((h) => h.title.toLowerCase().includes(q));
  if (heading) return { entry, href: `${entry.href}#${heading.id}`, heading: heading.title, score: 50 };
  if (entry.description.toLowerCase().includes(q)) return { entry, href: entry.href, score: 30 };
  return null;
}

export function searchDocs(index: DocsSearchEntry[], query: string, limit = 8): Hit[] {
  const q = normalise(query);
  if (!q) return [];
  return index
    .map((entry) => match(entry, q))
    .filter((h): h is Hit => h !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * The docs' own search box (top of the sidebar): looks through page titles, section headings,
 * descriptions and command aliases, keyboard-navigable (↑ ↓ Enter Esc). A heading match opens
 * the page at that section.
 */
export function DocsSearch({ index }: { index: DocsSearchEntry[] }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const hits = searchDocs(index, q);
  const shown = open && hits.length > 0;

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[Math.min(active, hits.length - 1)].href);
    }
  };

  return (
    <div className="docs-search relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
        placeholder="Search the docs…"
        aria-label="Search the documentation"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        className="h-10 w-full rounded-[10px] border border-border bg-card pl-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <ul
        id={listId}
        role="listbox"
        aria-label="Search results"
        hidden={!shown}
        className="docs-search-list absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-80 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
      >
        {/* each option is itself the thing to click (no control inside it: the box keeps the
            keyboard, aria-activedescendant names the active one); its fill is the selected
            row's (ui.css .ui-row[aria-current]), light enough for its muted line to read */}
        {hits.map((h, i) => (
          <li
            key={h.href}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(h.href)}
            className={cn("flex cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left", i === active && "bg-primary/6")}
          >
            <span className="text-sm text-foreground">{h.entry.title}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {h.entry.group}
              {h.heading ? ` · ${h.heading}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
