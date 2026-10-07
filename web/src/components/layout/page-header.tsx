/* The top of every page: title, one line of context, and the live / role / theme tools.
   `live={false}` drops the auto-refresh (the Terminal page has nothing to re-read). */
import { Eye, SquareTerminal } from "lucide-react";
import type { ReactNode } from "react";

import { currentRole } from "@/lib/auth/guard";
import { mayUseTerminal } from "@/lib/auth/session";
import { formatClock } from "@/lib/format";

import { LiveRefresh } from "./live-refresh";
import { ThemeToggle } from "./theme-toggle";

export async function PageHeader({ title, sub, live = true }: { title: string; sub?: ReactNode; live?: boolean }) {
  const operator = mayUseTerminal(await currentRole());
  return (
    <header className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-semibold text-balance">{title}</h1>
        {sub && <div className="text-[13.5px] text-muted">{sub}</div>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3 max-[820px]:ml-0">
        {live && <LiveRefresh renderedAt={formatClock(new Date())} />}
        {operator ? (
          <span className="pill" title="You can run assessments on the Terminal page; the other pages only read.">
            <SquareTerminal size={16} aria-hidden />
            operator
          </span>
        ) : (
          <span className="pill" title="This dashboard can only read; decisions are made in the terminal app.">
            <Eye size={16} aria-hidden />
            viewer
          </span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
