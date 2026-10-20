"use client";

/* The top bar: the live-refresh pill, the Assessment switcher (every width), the Target /
   Template / Status chips (wide screens; for the open run, or counts across every run), docs
   search, the "needs you" bell and the operator. */
import { AssessmentSwitcher } from "@/components/dashboard/assessment-switcher";
import { AttentionBell } from "@/components/dashboard/attention-bell";
import type { Dashboard } from "@/components/dashboard/derive";
import type { Overall } from "@/components/dashboard/derive-overall";
import { DocsSearch } from "@/components/dashboard/docs-search";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { OverallChips } from "@/components/dashboard/overall-chips";
import { RunChips } from "@/components/dashboard/run-chips";
import type { LibraryItem, SkippedFile } from "@/lib/data/view-types";

export function TopBar({
  dash,
  overall,
  items,
  dir,
  renderedAt,
  skipped,
  terminal,
}: {
  dash: Dashboard | null; // the open run, if one is open
  overall: Overall | null; // every saved run, when none is open
  items: LibraryItem[];
  dir: string;
  renderedAt: string;
  skipped: SkippedFile[];
  terminal: boolean;
}) {
  const a = dash?.assessment ?? null;
  const operator = dash
    ? { name: dash.assessment.operator, initials: dash.operatorInitials }
    : overall
      ? { name: overall.operators.join(", ") || "—", initials: overall.operatorInitials }
      : null;
  return (
    <header className="dash-topbar relative z-30 flex min-w-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-4">
      <LiveRefresh renderedAt={renderedAt} dir={dir} />
      {(dash || overall) && (
        <div className="dash-reveal flex min-w-0 items-center gap-2 lg:ml-auto">
          <AssessmentSwitcher current={a} all={overall} items={items} dir={dir} skipped={skipped} />
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            {dash ? <RunChips dash={dash} /> : overall && <OverallChips overall={overall} />}
          </div>
        </div>
      )}

      <div className="dash-reveal ml-auto flex shrink-0 items-center gap-2 lg:ml-3">
        <DocsSearch />
        <AttentionBell gate={dash?.gate ?? null} currentUid={a?.uid ?? null} items={items} terminal={terminal} />
        {operator && (
          <span
            aria-label={`Operator ${operator.name}`}
            title={`Operator ${operator.name}`}
            className="hidden size-10 place-items-center rounded-[10px] bg-surface text-[13px] font-medium text-primary sm:grid"
          >
            {operator.initials}
          </span>
        )}
      </div>
    </header>
  );
}
