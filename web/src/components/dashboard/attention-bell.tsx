"use client";

/* The bell: what needs you. First what the open run waits on, then every other saved run that
   waits on a decision (each opens that run); with every run shown (no run open), just the
   waiting runs. The dot shows while anything waits. Decisions themselves are made in the TUI
   (or the Terminal view): this only points at them. */
import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover } from "@/components/dashboard/popover";
import { useRunHref } from "@/components/dashboard/view-url";
import type { LibraryItem } from "@/lib/data/view-types";

const LINK = "rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AttentionBell({
  gate,
  currentUid,
  items,
  terminal,
}: {
  gate: { time: string; text: string } | null;
  currentUid: string | null; // null: no single run is open (the Overview totals every run)
  items: LibraryItem[];
  terminal: boolean; // this browser may use the Terminal view
}) {
  const hrefFor = useRunHref();
  const others = items.filter((i) => i.waiting && i.uid !== currentUid);
  const count = others.length + (gate ? 1 : 0);
  return (
    <Popover
      triggerAriaLabel={count ? `${count} waiting on you` : "Nothing waits on you"}
      align="end"
      panelClassName="w-[min(300px,calc(100vw-32px))] space-y-2.5 p-3 text-xs"
      triggerClassName="relative grid size-10 shrink-0 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:border-primary/50"
      triggerContent={
        <>
          <Bell className="size-[18px]" strokeWidth={1.6} aria-hidden />
          {count > 0 && <span className="dash-bell-dot absolute right-2 top-2 size-1.5 rounded-full bg-warning" aria-hidden />}
        </>
      }
    >
      {(close) => (
        <>
          {gate ? (
            <div>
              <p className="text-[13px] font-medium text-foreground">This run waits on you</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                [{gate.time}] {gate.text}
              </p>
            </div>
          ) : currentUid ? (
            <p className="text-[13px] text-foreground">Nothing waits on you in this run.</p>
          ) : (
            others.length === 0 && <p className="text-[13px] text-foreground">Nothing waits on you.</p>
          )}
          {others.length > 0 && (
            <div className={currentUid ? "border-t border-border pt-2.5" : undefined}>
              <p className="mb-1.5 text-muted-foreground">
                {others.length} {currentUid ? "other " : ""}
                {others.length === 1 ? "run waits" : "runs wait"} on a decision
              </p>
              <ul className="max-h-[200px] space-y-1 overflow-y-auto" data-lenis-prevent>
                {others.map((i) => (
                  <li key={i.uid}>
                    <Link
                      href={hrefFor(i.uid)}
                      onClick={close}
                      className="block rounded-md px-1.5 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block truncate text-foreground">
                        {i.id} · {i.template}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-warning">{i.waiting}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-muted-foreground">
            Decide in the TUI that runs it
            {terminal ? " (a run started in the Terminal view is decided there)" : ""}.{" "}
            <Link href="/docs/guardrails/approval-model" className={LINK}>
              Approval model
            </Link>
          </p>
        </>
      )}
    </Popover>
  );
}
