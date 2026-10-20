import { DashCard } from "@/components/dashboard/dash-card";
import type { OverviewCards } from "@/components/dashboard/derive";

// Cumulative tool steps over time (§5.9), on a 0 → total scale.
const X0 = 26;
const PW = 266;
const Y_TOP = 12;
const Y_BOT = 92;
const PH = Y_BOT - Y_TOP;

export function ToolActivity({ data }: { data: OverviewCards["tools"] }) {
  const { bars, used, max, ticks } = data;
  const step = PW / bars.length;
  const yFor = (v: number) => Y_TOP + (1 - v / max) * PH;
  const yUsed = yFor(used);
  const yLabels = [...new Set([max, Math.round(max / 2), 0])];
  return (
    <DashCard id="tool-activity" title="Tool Activity" docsHref="/docs/configuration/policies" className="h-[140px] 2xl:h-[156px]">
      <p className="mb-1 flex items-baseline gap-1">
        <span key={used} className="text-[22px] leading-none tabnums" data-countup>
          {used}
        </span>
        <span className="text-[11px] text-muted-foreground">{data.caption}</span>
      </p>
      <svg
        viewBox="0 0 300 112"
        preserveAspectRatio="none"
        className="h-[calc(100%-26px)] w-full"
        role="img"
        aria-label={data.summary}
      >
        {/* y grid labels */}
        {yLabels.map((v) => (
          <text key={v} x={2} y={yFor(v) + 3} fontSize={9} fontFamily="var(--font-mono)" fill="var(--muted-foreground)">
            {v}
          </text>
        ))}
        {/* faint vertical texture */}
        {bars.map((_, i) => (
          <line key={`g${i}`} x1={X0 + i * step} y1={Y_TOP} x2={X0 + i * step} y2={Y_BOT} stroke="color-mix(in oklab, var(--foreground) 4%, transparent)" strokeWidth={0.5} />
        ))}
        {/* bars */}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={X0 + i * step}
            y={yFor(b.value)}
            width={2}
            height={Math.max(0, Y_BOT - yFor(b.value))}
            fill={b.last ? "var(--primary-strong)" : "color-mix(in oklab, var(--primary) 55%, transparent)"}
            data-bar
            className={b.last && data.live ? "dash-breathe" : undefined}
          />
        ))}
        {/* total dashed line + left marker */}
        {used > 0 && (
          <>
            <line x1={X0} y1={yUsed} x2={X0 + PW} y2={yUsed} stroke="color-mix(in oklab, var(--primary) 55%, transparent)" strokeWidth={1} strokeDasharray="3 3" />
            <polygon points={`${X0 - 6},${yUsed - 4} ${X0 - 6},${yUsed + 4} ${X0 - 1},${yUsed}`} fill="var(--primary-strong)" />
          </>
        )}
        {/* x labels */}
        {ticks.map((t, i) => (
          <text
            key={t.pos}
            x={X0 + t.pos * (PW - step)}
            y={108}
            fontSize={9}
            fontFamily="var(--font-mono)"
            fill="var(--muted-foreground)"
            textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
          >
            {t.label}
          </text>
        ))}
      </svg>
    </DashCard>
  );
}
