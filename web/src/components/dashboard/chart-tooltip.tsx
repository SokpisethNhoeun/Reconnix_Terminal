"use client";

/* The charts' tooltip: shown while a mark is hovered or focused, above it (below when there is
   no room), kept on screen. It repeats the mark's accessible name for sighted users, so it is
   hidden from screen readers. Fixed to the viewport, so no card or scroller clips it; it hides
   when anything scrolls or the window resizes. */
import { useCallback, useEffect, useState } from "react";

export interface Tip {
  x: number;
  y: number;
  below: boolean;
  title: string;
  lines: string[];
}

const EDGE = 150; // keep the tooltip's centre this far from the window's sides
const ROOM = 96; // flip below the mark when there is less room than this above it

export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = useCallback((el: Element, title: string, lines: string[] = []) => {
    const r = el.getBoundingClientRect();
    const below = r.top < ROOM;
    const x = Math.min(Math.max(r.left + r.width / 2, EDGE), window.innerWidth - EDGE);
    setTip({ x, y: below ? r.bottom : r.top, below, title, lines });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  useEffect(() => {
    if (!tip) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tip, hide]);
  return { tip, show, hide };
}

export function ChartTooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div aria-hidden className="dash-tooltip" data-below={tip.below ? "" : undefined} style={{ left: tip.x, top: tip.y }}>
      <p className="font-medium text-foreground">{tip.title}</p>
      {tip.lines.map((line, i) => (
        <p key={i} className="text-muted-foreground [overflow-wrap:anywhere]">
          {line}
        </p>
      ))}
    </div>
  );
}
