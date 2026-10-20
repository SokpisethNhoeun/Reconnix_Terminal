"use client";

/* The AI orb: the dashboard globe's colours in a small CSS sphere (dots, a lit side, a halo).
   It breathes on the shared cycle when `live` (the header's mark, a reply being written); a
   reply's avatar otherwise holds still, so a long conversation isn't a wall of motion. */
import { cn } from "@/lib/utils";
import { useBreathPhase } from "./breath";

export function AssistantOrb({ size, className, live = true }: { size: number; className?: string; live?: boolean }) {
  const phase = useBreathPhase(live);
  return (
    <span aria-hidden data-live={live ? "" : undefined} className={cn("dash-orb", className)} style={{ width: size, height: size, ...phase }}>
      <span className="dash-orb-dots" />
    </span>
  );
}
