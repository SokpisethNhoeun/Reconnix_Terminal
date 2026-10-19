/* The Documentation sub-nav: the sections down the left, the current one lit. */
import Link from "next/link";

import { cn } from "@/lib/utils";

import { SECTIONS } from "./sections";

export function DocsNav({ current }: { current: string }) {
  return (
    <nav className="card sticky top-6 gap-1 self-start p-3" aria-label="Documentation sections">
      <span className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Documentation</span>
      {SECTIONS.map((s) => (
        <Link
          key={s.id}
          href={`/about${s.id === "overview" ? "" : `?s=${s.id}`}`}
          aria-current={s.id === current ? "page" : undefined}
          className={cn(
            "rounded-[9px] px-3 py-2 text-[13.5px] transition-colors",
            s.id === current ? "bg-accent-wash font-medium text-accent" : "text-muted hover:text-text",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
