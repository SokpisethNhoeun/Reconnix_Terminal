/* A pressed-in message strip (waiting, stopped, skipped files). */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { Tone } from "./chips";

export function Notice({ icon, tone = "warn", children }: { icon: ReactNode; tone?: Tone; children: ReactNode }) {
  return (
    <div className="notice" role="status">
      <span className={cn("inline-flex flex-none text-tone", `tone-${tone}`)}>{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
