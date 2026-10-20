/* Placing things on a time axis without overlap, for the Overview's timelines. Positions are
   fractions of the axis (0 = its left edge, 1 = its right edge). Pure; tested in
   tests/dashboard.test.ts. */

/** Marks closer than this (a fraction of the axis) merge into one mark with a count. The
    charts are at least 360 px wide (they scroll sideways below that), so neighbouring marks
    stay ≥ 18 px apart: enough for a dot or a count pill. */
export const CLUSTER_GAP = 0.05;

/** The most tool segments one track shows; beyond it the narrowest neighbours merge. */
export const MAX_SEGMENTS = 24;

export type Marker = { pos: number; label: string };

export interface Cluster<T> {
  start: number; // the first item's position
  end: number; // the last item's position
  items: T[];
}

/** Items grouped so that no two groups are within `gap` of each other: an item joins the
    previous group when it is at most `gap` after that group's last item. */
export function cluster<T>(items: { pos: number; item: T }[], gap = CLUSTER_GAP): Cluster<T>[] {
  const out: Cluster<T>[] = [];
  for (const { pos, item } of [...items].sort((a, b) => a.pos - b.pos)) {
    const last = out[out.length - 1];
    if (last && pos - last.end <= gap) {
      last.end = pos;
      last.items.push(item);
    } else out.push({ start: pos, end: pos, items: [item] });
  }
  return out;
}

/** Labelled ticks at `positions`, dropping a label that repeats the one before it. */
export function ticksAt(positions: number[], labelAt: (pos: number) => string): Marker[] {
  const ticks = positions.map((pos) => ({ pos, label: labelAt(pos) }));
  return ticks.filter((t, i) => i === 0 || t.label !== ticks[i - 1].label);
}

/** Round ticks for a count axis that reaches at least `max`: about three steps of 1, 2, 5, 10,
    20, 25, 50… (`top` is the axis's end, the last tick). */
export function countTicks(max: number): { ticks: number[]; top: number } {
  const want = Math.max(1, max) / 3;
  const power = 10 ** Math.floor(Math.log10(want));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= want && Number.isInteger(s)) ?? 10 * power);
  const top = Math.max(step, Math.ceil(Math.max(1, max) / step) * step);
  return { ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step), top };
}

export interface Segment {
  key: string;
  tools: string[]; // the tools (or step names) it covers, in order
  start: number;
  end: number;
  steps: number; // tool log lines it stands for
  times: string[]; // their clock times
}

/** A segment's name: "Semgrep", "Semgrep + gitleaks", "Semgrep + 3 more". */
export const segmentLabel = (tools: string[]) => (tools.length > 2 ? `${tools[0]} + ${tools.length - 1} more` : tools.join(" + "));

/** At most `max` segments: the narrowest pair of neighbours merges until it fits (a long run
    still shows its whole shape, and nothing overlaps). */
export function mergeNarrow(segments: Segment[], max = MAX_SEGMENTS): Segment[] {
  const out = segments.map((s) => ({ ...s, tools: [...s.tools], times: [...s.times] }));
  while (out.length > max) {
    let at = 0;
    let best = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const width = out[i + 1].end - out[i].start;
      if (width < best) {
        best = width;
        at = i;
      }
    }
    const [a, b] = [out[at], out[at + 1]];
    out.splice(at, 2, {
      key: a.key,
      tools: [...new Set([...a.tools, ...b.tools])],
      start: a.start,
      end: Math.max(a.end, b.end),
      steps: a.steps + b.steps,
      times: [...a.times, ...b.times],
    });
  }
  return out;
}
