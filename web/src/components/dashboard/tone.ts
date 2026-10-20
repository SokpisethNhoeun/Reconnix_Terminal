/* A tone from derive.ts as a CSS colour. "dim" (INFO findings, stopped runs) has no token of its
   own: it is drawn in the muted text colour. */
import type { Tone } from "@/lib/data/view-types";

export const toneColor = (tone: Tone) => `var(--${tone === "dim" ? "muted-foreground" : tone})`;
