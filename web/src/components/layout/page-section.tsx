/* A titled part of a long page, the landing site's way: a mono eyebrow, a heading and one
   line of lede above the content. `id` makes it a jump target. */
import type { ReactNode } from "react";

interface PageSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}

export function PageSection({ id, eyebrow, title, lede, children }: PageSectionProps) {
  const heading = `${id}-title`;
  return (
    <section id={id} aria-labelledby={heading} className="flex scroll-mt-6 flex-col gap-4">
      <header className="flex max-w-3xl flex-col gap-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={heading} className="text-xl leading-tight font-semibold text-balance">
          {title}
        </h2>
        {lede && <p className="text-[13.5px] text-muted">{lede}</p>}
      </header>
      {children}
    </section>
  );
}
