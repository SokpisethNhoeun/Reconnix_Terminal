/* The top of every page: title, one line of context, and the live / role / theme tools. */
import { Eye } from "lucide-react";
import type { ReactNode } from "react";

import { formatClock } from "@/lib/format";

import { LiveRefresh } from "./live-refresh";
import { ThemeToggle } from "./theme-toggle";

export function PageHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-semibold text-balance">{title}</h1>
        {sub && <div className="text-[13.5px] text-muted">{sub}</div>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3 max-[820px]:ml-0">
        <LiveRefresh renderedAt={formatClock(new Date())} />
        <span className="pill" title="This dashboard can only read; decisions are made in the terminal app.">
          <Eye size={16} aria-hidden />
          viewer
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
