"use client";

/* The AI orb: the dashboard globe's colours in a small CSS sphere (dots, a lit side, a halo),
   breathing on the shared cycle. No second WebGL context. */
import { cn } from "@/lib/utils";
import { useBreathPhase } from "./breath";

export function AssistantOrb({ size, className }: { size: number; className?: string }) {
  const phase = useBreathPhase();
  return (
    <span aria-hidden className={cn("dash-orb", className)} style={{ width: size, height: size, ...phase }}>
      <span className="dash-orb-dots" />
    </span>
  );
}
