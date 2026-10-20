import { SITE_TAGLINE } from "@/lib/site";
import { Globe } from "@/components/dashboard/globe";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { AskBar } from "@/components/dashboard/ask-bar";
import { ProgressGauge } from "@/components/dashboard/progress-gauge";
import { ToolActivity } from "@/components/dashboard/tool-activity";
import { FindingsCard } from "@/components/dashboard/findings-card";
import { StatCards } from "@/components/dashboard/stat-cards";
import { ExecutionTimeline } from "@/components/dashboard/execution-timeline";
import type { OverviewCards } from "@/components/dashboard/derive";

/** Overview: the at-a-glance dashboard (globe + stats + charts), for one run or for every
    saved run (the cards draw whichever `cards` they get). Server component. */
export function OverviewView({ cards }: { cards: OverviewCards }) {
  return (
    <div className="dash-overview">
      <section aria-label="Assessment overview" className="dash-hero">
        <Globe />
        <div className="dash-hero-title">
          <h1 className="dash-reveal text-[26px] font-medium leading-[1.15] tracking-[-0.01em] text-foreground">
            Assessment Operations Center
          </h1>
          <p className="dash-reveal mt-1 text-[13px] text-muted-foreground">{SITE_TAGLINE}</p>
        </div>
        <div className="dash-timeline-card">
          <ActivityTimeline data={cards.activity} />
        </div>
        <AskBar data={cards.ask} />
      </section>

      <div className="dash-bottom">
        <StatCards cards={cards.statCards} />
        <ExecutionTimeline data={cards.execution} />
      </div>

      <div className="dash-right">
        <ProgressGauge data={cards.gauge} />
        <ToolActivity data={cards.tools} />
        <FindingsCard data={cards.findings} />
      </div>
    </div>
  );
}
