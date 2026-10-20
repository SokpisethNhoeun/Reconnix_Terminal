import { DashCard } from "@/components/dashboard/dash-card";
import type { OverviewCards } from "@/components/dashboard/derive";
import { FINDING_ICON } from "@/components/dashboard/finding-icon";
import { ViewLink } from "@/components/dashboard/view-link";

// Per-tile colour (High is a dimmer danger than Critical, like the reference).
const TILE_COLOR: Record<string, string> = {
  CRITICAL: "var(--danger)",
  HIGH: "color-mix(in oklab, var(--danger) 70%, var(--muted-foreground))",
  MEDIUM: "var(--accent)",
  LOW: "var(--success)",
};
const TILES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function FindingsCard({ data }: { data: OverviewCards["findings"] }) {
  const tiles = data.severity.filter((s) => TILES.includes(s.level));
  const info = data.severity.find((s) => s.level === "INFO")?.count ?? 0;
  const { confirmed, needsReview } = data.review;
  return (
    <DashCard
      id="findings-card"
      title="Findings by Severity"
      docsHref="/docs/reference/findings"
      className="flex-1"
      bodyClassName="flex flex-col gap-3"
    >
      {/* 2×2 severity tiles */}
      <div role="group" aria-label={`Findings by severity: ${data.words}`} className="grid grid-cols-2 gap-2">
        {tiles.map((s, i) => (
          <div
            key={s.level}
            className="dash-tile relative flex flex-col justify-between overflow-hidden p-2.5"
            style={i === 0 ? { borderLeft: `2px solid ${TILE_COLOR.CRITICAL}` } : undefined}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-[11px] capitalize text-muted-foreground">{s.level.toLowerCase()}</span>
              <span
                className="dash-chip h-[18px] rounded-md px-1.5 text-[9px]"
                style={{ background: `color-mix(in oklab, ${TILE_COLOR[s.level]} 12%, transparent)`, color: TILE_COLOR[s.level] }}
              >
                {s.share}%
              </span>
            </div>
            {/* keyed by value: a live update makes a fresh element (the intro's count-up
                rewrites the text of the first one, which React would no longer update) */}
            <span key={s.count} className="text-[24px] leading-none tabnums" data-countup>
              {s.count}
            </span>
            {s.count > 0 && (
              <ViewLink
                view="findings"
                filters={{ sev: s.level }}
                label={`Show the ${s.count} ${s.level.toLowerCase()} ${s.count === 1 ? "finding" : "findings"}`}
                className="absolute inset-0 rounded-[inherit]"
              >
                <span className="sr-only">{s.level.toLowerCase()}</span>
              </ViewLink>
            )}
          </div>
        ))}
      </div>

      {/* Top findings · CVSS */}
      <p className="text-[13px] font-medium text-foreground">Top findings · CVSS</p>
      {data.top.length ? (
        <ul className="flex flex-col gap-2">
          {data.top.map((f) => {
            const Icon = FINDING_ICON[f.icon];
            const fill = f.severity === "CRITICAL" ? "var(--danger)" : "var(--accent)";
            return (
              <li key={f.key} className="relative flex items-center gap-2.5">
                <ViewLink
                  view="findings"
                  filters={{ finding: f.key }}
                  label={`Open ${f.id}${f.run ? ` (${f.run})` : ""}: ${f.title}`}
                  className="absolute inset-0 rounded-lg"
                >
                  <span className="sr-only">{f.id}</span>
                </ViewLink>
                <span className="dash-tile grid size-[30px] shrink-0 place-items-center rounded-lg">
                  <Icon className="size-4 text-muted-foreground" strokeWidth={1.6} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-foreground">{f.title}</span>
                    <span className="shrink-0 font-mono text-[11px] tabnums text-foreground">{f.score.toFixed(1)}</span>
                  </div>
                  <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" data-bar-x style={{ width: `${f.score * 10}%`, background: fill }} />
                  </div>
                  {f.run && <p className="mt-1 truncate font-mono text-[9.5px] text-muted-foreground">{f.run}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No CVSS-scored findings yet.</p>
      )}

      <p className="mt-auto font-mono text-[9.5px] text-muted-foreground">
        {confirmed} confirmed · {needsReview} need review{info ? ` · ${info} info` : ""}
      </p>
    </DashCard>
  );
}
