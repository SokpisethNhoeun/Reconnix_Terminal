/* A raised card with an optional heading row (title, hint, actions on the right). */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  hint?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, hint, actions, className, children }: CardProps) {
  return (
    <section className={cn("card", className)} aria-label={title}>
      {(title || actions) && (
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          {title && <h2 className="text-[15.5px] font-semibold leading-tight">{title}</h2>}
          {hint && <span className="text-[12.5px] text-muted">{hint}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
