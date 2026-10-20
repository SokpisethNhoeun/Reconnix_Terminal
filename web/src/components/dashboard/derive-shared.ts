/* Small helpers the derive modules share (derive.ts, derive-activity.ts, derive-execution.ts,
   derive-overall.ts). Pure. */
import { STEP_STATUS, toneColor } from "@/lib/status";

import type { LegendItem } from "./overview-types";

/** Where a run's time axis puts its ticks. */
export const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1];

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Legend entries for the plan step states. */
export const STEP_LEGEND: LegendItem[] = (["done", "active", "pending"] as const).map((s) => ({
  label: STEP_STATUS[s].label,
  color: toneColor(STEP_STATUS[s].tone),
  hint: STEP_STATUS[s].hint,
  shape: "bar",
}));
