/* The scroll container around every data table. It can take focus, so keyboard users can
   scroll a wide table sideways (WCAG 2.1.1); `label` names it for assistive tech. */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TableWrap({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("table-wrap", className)} role="group" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
