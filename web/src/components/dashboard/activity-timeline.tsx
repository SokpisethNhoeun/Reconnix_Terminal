import { DashCard } from "@/components/dashboard/dash-card";
import type { OverviewCards } from "@/components/dashboard/derive";

const barColor = (tone: string) =>
  tone === "dim"
    ? "color-mix(in oklab, var(--primary-dim) 35%, transparent)"
    : tone === "danger"
      ? "color-mix(in oklab, var(--danger) 85%, transparent)"
      : tone === "accent"
        ? "var(--accent)"
        : "var(--primary)";

// Top chart geometry (positions are fractions of the run, 0 → 1)
const X0 = 4;
const PW = 230;
const T_TOP = 6;
const T_BOT = 58;
const xFor = (pos: number) => X0 + pos * PW;
const pct = (pos: number) => `${(xFor(pos) / 240) * 100}%`;

// Bottom chart (peaks)
const P_BASE = 40;
const P_H = 30;
const bell = (x: number) =>
  `M ${x - 6},${P_BASE} C ${x - 3},${P_BASE} ${x - 3},${P_BASE - P_H} ${x},${P_BASE - P_H} C ${x + 3},${P_BASE - P_H} ${x + 3},${P_BASE} ${x + 6},${P_BASE} Z`;

export function ActivityTimeline({ data }: { data: OverviewCards["activity"] }) {
  const { bars, brackets, peaks, lastPeak } = data;
  return (
    <DashCard
      id="activity-timeline"
      title="Activity Timeline"
      docsHref="/docs/assessments/workflow"
      glass
      bodyClassName="flex flex-col justify-between"
    >
      {/* top: event bars by kind */}
      <svg
        viewBox="0 0 240 66"
        preserveAspectRatio="none"
        className="w-full"
        role="img"
        aria-label={data.summary}
      >
        {bars.map((b, i) => {
          const h = ((T_BOT - T_TOP) * b.heightPct) / 100;
          return (
            <rect key={i} x={xFor(b.pos)} y={T_BOT - h} width={2} height={h} fill={barColor(b.tone)} data-bar>
              <title>{b.title}</title>
            </rect>
          );
        })}
        {/* bracket markers at the first/last tool step */}
        {brackets.map((brk) => (
          <g key={brk.pos}>
            <line x1={xFor(brk.pos)} y1={T_TOP} x2={xFor(brk.pos)} y2={T_BOT} stroke="color-mix(in oklab, var(--foreground) 30%, transparent)" strokeWidth={0.75} strokeDasharray="2 2" />
            <polygon
              points={`${xFor(brk.pos) - 3},${T_TOP - 4} ${xFor(brk.pos) + 3},${T_TOP - 4} ${xFor(brk.pos)},${T_TOP}`}
              fill="var(--muted-foreground)"
            />
          </g>
        ))}
      </svg>

      {/* bracket labels, placed under their markers */}
      <div className="relative h-3 font-mono text-[9.5px] text-muted-foreground">
        {brackets.filter((b) => b.label).map((b) => (
          <span
            key={b.pos}
            className={`absolute whitespace-nowrap ${b.pos < 0.15 ? "" : b.pos > 0.85 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: pct(b.pos) }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* bottom: peaks at finding / gate times */}
      <svg viewBox="0 0 240 48" preserveAspectRatio="none" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="peak-danger" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--danger) 70%, transparent)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="peak-accent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--accent) 70%, transparent)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <line x1={X0} y1={P_BASE} x2={X0 + PW} y2={P_BASE} stroke="var(--border)" strokeWidth={1} />
        {peaks.map((p, i) => (
          <path key={i} d={bell(xFor(p.pos))} fill={p.tone === "accent" ? "url(#peak-accent)" : "url(#peak-danger)"} stroke={`var(--${p.tone})`} strokeWidth={0.75}>
            <title>{p.title}</title>
          </path>
        ))}
        {/* dashed marker under the latest spike */}
        {lastPeak && (
          <line x1={xFor(lastPeak.pos)} y1={P_BASE - P_H} x2={xFor(lastPeak.pos)} y2={P_BASE + 5} stroke="color-mix(in oklab, var(--foreground) 30%, transparent)" strokeWidth={0.75} strokeDasharray="2 2" />
        )}
      </svg>
      <div className="px-1 text-right font-mono text-[9.5px] text-muted-foreground">
        {lastPeak ? lastPeak.label : data.idle}
      </div>
    </DashCard>
  );
}
