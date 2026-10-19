"use client";

/* Findings by severity as a donut of the four counted levels (critical, high, medium, low)
   with a legend of counts and shares beside it. Info items are not vulnerabilities, so they
   are left off the ring and noted underneath. The center shows the vulnerability total. */
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { Finding } from "@/lib/data/schema";
import { isFalsePositive, severityCounts } from "@/lib/data/stats";
import { plural } from "@/lib/format";

const RING = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export function SeverityDonut({ findings }: { findings: Finding[] }) {
  const real = findings.filter((f) => !isFalsePositive(f));
  const counts = severityCounts(real);
  const total = RING.reduce((n, s) => n + counts[s], 0);
  const info = counts.INFO;
  const data = RING.map((s) => ({ name: s, value: counts[s] })).filter((d) => d.value > 0);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="donut" role="img" aria-label={`${plural(total, "vulnerability", "vulnerabilities")} by severity`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={total ? data : [{ name: "empty", value: 1 }]}
                dataKey="value"
                innerRadius="68%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={total ? 2 : 0}
                stroke="none"
                isAnimationActive={false}
              >
                {total ? (
                  data.map((d) => <Cell key={d.name} fill={`var(--${d.name.toLowerCase()})`} />)
                ) : (
                  <Cell fill="var(--well)" />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <span className="font-display text-[28px] leading-none font-semibold tabular-nums">{total}</span>
            <span className="mt-1 block text-[11px] text-muted">{total === 1 ? "vulnerability" : "vulnerabilities"}</span>
          </div>
        </div>

        <dl className="m-0 min-w-[200px] flex-1">
          {RING.map((s) => {
            const value = counts[s];
            const pct = total ? Math.round((value / total) * 100) : 0;
            return (
              <div key={s} className="legend-row">
                <i className={`legend-swatch sev-${s}`} aria-hidden />
                <dt className="text-[13px]">{s[0] + s.slice(1).toLowerCase()}</dt>
                <dd className="m-0 text-right font-mono text-[13px] font-semibold tabular-nums">{value}</dd>
                <dd className="m-0 w-10 text-right font-mono text-[12px] text-muted tabular-nums">{pct}%</dd>
              </div>
            );
          })}
        </dl>
      </div>

      {info > 0 && (
        <p className="text-[12.5px] text-muted">
          +{plural(info, "info item")}, not counted ·{" "}
          <Link className="link" href="/findings?sev=INFO">
            view on Findings
          </Link>
        </p>
      )}
    </div>
  );
}
