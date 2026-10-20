import { DashCard } from "@/components/dashboard/dash-card";
import type { OverviewCards } from "@/components/dashboard/derive";

// Semicircle gauge (§5.8): radial ticks on an arc from 200° to −20°, lit up to the progress.
const CX = 100;
const CY = 108;
const R_OUT = 92;
const R_IN = 83;
const A0 = 200;
const A1 = -20;
const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const angleAt = (frac: number) => A0 + (A1 - A0) * frac;

function gauge(count: number, lit: number, progress: number) {
  const ticks = Array.from({ length: count }, (_, i) => {
    const deg = angleAt(i / (count - 1));
    const o = pt(R_OUT, deg);
    const inr = pt(R_IN, deg);
    const on = i < lit;
    return {
      x1: o.x, y1: o.y, x2: inr.x, y2: inr.y,
      color: on
        ? i < 6
          ? "var(--primary-strong)"
          : "var(--primary)"
        : "color-mix(in oklab, var(--primary-dim) 30%, transparent)",
      lit: on,
    };
  });
  // Triangle marker at the progress point, just outside the arc, pointing inward.
  const mDeg = angleAt(progress / 100);
  const tip = pt(R_OUT - 1, mDeg);
  const outer = pt(R_OUT + 9, mDeg);
  const tan = { x: -Math.sin((mDeg * Math.PI) / 180), y: -Math.cos((mDeg * Math.PI) / 180) };
  const bA = { x: outer.x + 3.5 * tan.x, y: outer.y - 3.5 * tan.y };
  const bB = { x: outer.x - 3.5 * tan.x, y: outer.y + 3.5 * tan.y };
  return { ticks, marker: `${tip.x},${tip.y} ${bA.x},${bA.y} ${bB.x},${bB.y}` };
}

export function ProgressGauge({ data }: { data: OverviewCards["gauge"] }) {
  const { ticks, marker } = gauge(data.ticks, data.lit, data.value);
  return (
    <DashCard
      id="progress-gauge"
      title="Assessment Progress"
      docsHref="/docs/interfaces/local-viewer"
      className="h-[132px] 2xl:h-[148px]"
      bodyClassName="relative"
    >
      <svg
        viewBox="0 0 200 150"
        preserveAspectRatio="xMidYMin meet"
        className="h-full w-full"
        role="img"
        aria-label={data.summary}
      >
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={t.lit ? { filter: "drop-shadow(0 0 2px color-mix(in oklab, var(--primary) 60%, transparent))" } : undefined}
          />
        ))}
        <polygon
          points={marker}
          fill="var(--primary-strong)"
          className="dash-marker-breathe"
        />
      </svg>

      {/* centre readout */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1 flex-col items-center">
        <span key={data.value} className="text-[34px] font-normal leading-none tabnums" data-countup data-count-format="pct">
          {`${data.value}%`}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {data.live && <span className="dash-livedot inline-block size-1.5 rounded-full" aria-hidden />}
          {data.caption}
        </span>
      </div>
    </DashCard>
  );
}
