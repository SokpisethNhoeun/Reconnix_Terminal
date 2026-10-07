"use client";

/* Findings per day: one series of columns (accent), a hover tooltip, the peak and the
   latest day labeled, and a table view of the same numbers. The chart grows to the card's
   height (at least 220px), so it fills the row next to Findings by severity. */
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TableWrap } from "../neu/table-wrap";

export interface DayPoint {
  label: string;
  findings: number;
  assessments: number;
}

function DayTooltip({ point }: { point?: DayPoint }) {
  if (!point) return null;
  const d = point;
  return (
    <div className="rounded-[10px] bg-card px-3 py-2 font-mono text-xs shadow-[var(--raise-sm)]">
      {d.label}: {d.findings} finding{d.findings === 1 ? "" : "s"} from {d.assessments} assessment
      {d.assessments === 1 ? "" : "s"}
    </div>
  );
}

export function PerDayChart({ data }: { data: DayPoint[] }) {
  const [table, setTable] = useState(false);
  const peak = Math.max(0, ...data.map((d) => d.findings));
  const top = Math.max(2, Math.ceil(peak / 2) * 2);
  const labeled = data.map((d, i) => ({ ...d, mark: d.findings > 0 && (d.findings === peak || i === data.length - 1) ? d.findings : null }));

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="seg self-end" role="group" aria-label="View">
        <button type="button" aria-pressed={!table} onClick={() => setTable(false)}>
          Chart
        </button>
        <button type="button" aria-pressed={table} onClick={() => setTable(true)}>
          Table
        </button>
      </div>
      {table ? (
        <TableWrap label="Findings per day table">
          <table className="data">
            <thead>
              <tr>
                <th>Day</th>
                <th className="text-right">Assessments</th>
                <th className="text-right">Findings</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="text-right tabular-nums">{d.assessments}</td>
                  <td className="text-right tabular-nums">{d.findings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <div className="relative min-h-[220px] flex-1" role="img" aria-label="Findings per day">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labeled} margin={{ top: 18, right: 6, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, top]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <Tooltip cursor={{ fill: "var(--accent-wash)", opacity: 0.6 }} content={({ active, payload }) => (
                    <DayTooltip point={active ? (payload?.[0]?.payload as DayPoint | undefined) : undefined} />
                  )}
                />
                <Bar dataKey="findings" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                  <LabelList dataKey="mark" position="top" style={{ fill: "var(--text)", fontSize: 11.5, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
