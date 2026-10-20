import { Clock } from "lucide-react";
import { DashCard } from "@/components/dashboard/dash-card";
import { LANE_FRAC, type OverviewCards, type Ring as RingData } from "@/components/dashboard/derive";
import { toneColor } from "@/components/dashboard/tone";

const X0 = 6;
const PW = 308;
const TOP = 10;
const BOT = 84;
const PH = BOT - TOP;
const xFor = (pos: number) => X0 + pos * PW;
const yFor = (frac: number) => TOP + frac * PH;
const MID = yFor(0.5);

function Ring({ used, max, label, over = false }: RingData) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(1, used / max) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden>
        <circle cx={11} cy={11} r={r} fill="none" stroke="var(--muted)" strokeWidth={2} />
        <circle
          cx={11}
          cy={11}
          r={r}
          fill="none"
          stroke={over ? "var(--accent)" : "var(--primary)"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 11 11)"
        />
      </svg>
      <div className="leading-tight">
        <div className="font-mono text-[11px] tabnums" style={{ color: over ? "var(--accent)" : "var(--foreground)" }}>
          {used}/{max}
        </div>
        <div className="text-[9.5px] text-muted-foreground">{over ? `${label} · over the limit` : label}</div>
      </div>
    </div>
  );
}

export function ExecutionTimeline({ data }: { data: OverviewCards["execution"] }) {
  const { lanes, currentPos, ticks, rings } = data;
  const currentX = xFor(currentPos);
  return (
    <DashCard id="execution-timeline" title="Execution Timeline" docsHref="/docs/assessments/workflow" bodyClassName="flex flex-col">
      <div className="mb-2 flex items-center gap-4">
        {rings.slice(0, 1).map((r) => (
          <Ring key={r.label} {...r} />
        ))}
        <span className="dash-chip h-[26px] border border-border px-2 text-[10px] text-muted-foreground">
          <Clock className="size-3" aria-hidden /> {data.chip}
        </span>
        {rings.slice(1).map((r) => (
          <Ring key={r.label} {...r} />
        ))}
      </div>

      <div className="relative min-h-[120px] flex-1">
        <svg
          viewBox="0 0 320 88"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={data.summary}
        >
          {/* lit column behind the current time */}
          <rect x={currentX - 20} y={TOP} width={40} height={PH} fill="color-mix(in oklab, var(--primary) 8%, transparent)" />
          {/* x grid */}
          {ticks.map((t) => (
            <line key={t.pos} x1={xFor(t.pos)} y1={TOP} x2={xFor(t.pos)} y2={BOT} stroke="color-mix(in oklab, var(--foreground) 5%, transparent)" strokeWidth={0.5} />
          ))}
          {/* mid line */}
          <line x1={X0} y1={MID} x2={X0 + PW} y2={MID} stroke="color-mix(in oklab, var(--foreground) 25%, transparent)" strokeWidth={1} />
          {/* lanes */}
          {lanes.map((lane, i) => {
            const y = yFor(LANE_FRAC[i % LANE_FRAC.length]);
            const color = toneColor(lane.tone);
            if (lane.kind === "dot") {
              return (
                <circle key={lane.key} cx={xFor(lane.start)} cy={y} r={3} fill={color} data-lane={lane.label}>
                  <title>{`${lane.label} · ${lane.title}`}</title>
                </circle>
              );
            }
            return (
              <rect
                key={lane.key}
                x={xFor(lane.start)}
                y={y - 1.5}
                width={Math.max(2, xFor(lane.end) - xFor(lane.start))}
                height={3}
                rx={1.5}
                fill={color}
                data-lane={lane.label}
                className={lane.pulse ? "dash-gate-pulse" : undefined}
                style={lane.pulse ? { filter: "drop-shadow(0 0 4px color-mix(in oklab, var(--accent) 60%, transparent))" } : undefined}
              >
                <title>{`${lane.label} · ${lane.title}`}</title>
              </rect>
            );
          })}
          <circle cx={currentX} cy={MID} r={3.5} fill="var(--primary)" />
        </svg>
        {/* x-axis labels as HTML, so the font is not stretched by the SVG scale */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 font-mono text-[9.5px] text-muted-foreground">
          {ticks.map((t) => (
            <span key={t.pos} className="absolute -translate-x-1/2" style={{ left: `${(xFor(t.pos) / 320) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </DashCard>
  );
}
