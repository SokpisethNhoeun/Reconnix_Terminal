import Link from "next/link";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard card: a labelled <section> with the card chrome, a header (title left,
 * "open in docs" icon right) and the card body. The cursor-following light is CSS
 * (.dash-card::before); the pointer wiring that moves it is added in Phase 5.
 */
export function DashCard({
  id,
  title,
  docsHref,
  glass,
  className,
  bodyClassName,
  children,
}: {
  id: string;
  title: string;
  docsHref: string;
  glass?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("dash-card flex flex-col", glass && "dash-glass", className)}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 id={id} className="text-[13px] font-medium text-foreground">
          {title}
        </h2>
        <Link
          href={docsHref}
          aria-label={`Open ${title} documentation`}
          className="dash-card-open shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <SquareArrowOutUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
