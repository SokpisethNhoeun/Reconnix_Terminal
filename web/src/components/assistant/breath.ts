"use client";

/* One 4-second breathing cycle shared by the sidebar's AI icon, the orb and the chat panel:
   each loop starts with a negative delay taken from the page clock, so all three swell and
   settle together whenever they start. */
import { useEffect, useState } from "react";

export const BREATH_MS = 4_000;

export const breathDelay = () => `-${Math.round(performance.now() % BREATH_MS)}ms`;

/** `{ animationDelay }` for a breathing element, set after mount (the server has no clock). */
export function useBreathPhase(active = true): React.CSSProperties | undefined {
  const [delay, setDelay] = useState<string>();
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => setDelay(breathDelay()));
    return () => cancelAnimationFrame(id);
  }, [active]);
  return delay ? { animationDelay: delay } : undefined;
}
