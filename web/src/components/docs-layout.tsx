import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { DocsSidebar } from "@/components/docs-sidebar";
import { DocsToc } from "@/components/docs-toc";
import { docNeighbours, findDoc } from "@/lib/docs-nav";
import { docsSearchIndex } from "@/lib/docs-search-index";

// The content building blocks live in docs-primitives.tsx; re-exported for the app pages.
export { Callout, Code, DocLink, DocSection, DocTable, Facts, Kbd, KeyTable, Mono, Steps, slugify } from "@/components/docs-primitives";

/**
 * Docs page frame: search and the grouped sidebar (left), breadcrumb + title + content +
 * prev/next (centre), "On this page" (right, xl). Title, breadcrumb and neighbours all come
 * from DOCS_NAV via `href`; the search index is built once on the server from the content.
 */
export function DocsLayout({
  href,
  title,
  lede,
  children,
}: {
  /** this page's route, as listed in DOCS_NAV */
  href: string;
  /** defaults to the DOCS_NAV title */
  title?: string;
  lede: string;
  children: React.ReactNode;
}) {
  const entry = findDoc(href);
  const heading = title ?? entry?.title ?? "Documentation";
  const { prev, next } = docNeighbours(href);
  const crumbs = [{ label: "Docs", href: "/docs" }];
  if (entry && entry.group.href !== "/docs") crumbs.push({ label: entry.group.title, href: entry.group.href });
  if (entry && !entry.isGroup) crumbs.push({ label: entry.title, href: entry.href });

  return (
    // inside the dashboard frame's content area (app/docs/layout.tsx), which is the <main>
    <div className="docs-main mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:py-8 xl:grid-cols-[240px_minmax(0,1fr)_200px]">
      <DocsSidebar index={docsSearchIndex()} />

      <article className="min-w-0 max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                {i < crumbs.length - 1 ? (
                  <Link href={c.href} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-primary">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-[2rem]">{heading}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">{lede}</p>

        <div data-docs-content className="mt-8 space-y-10">
          {children}
        </div>

        {(prev || next) && (
          <nav aria-label="Previous and next page" className="mt-12 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            {prev ? (
              <Link
                href={prev.href}
                className="dash-card group transition-colors hover:border-primary/50"
              >
                <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <ArrowLeft className="size-3.5" aria-hidden /> Previous
                </span>
                <span className="mt-1.5 block font-display font-semibold text-foreground group-hover:text-primary">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link
                href={next.href}
                className="dash-card group text-right transition-colors hover:border-primary/50"
              >
                <span className="flex items-center justify-end gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Next <ArrowRight className="size-3.5" aria-hidden />
                </span>
                <span className="mt-1.5 block font-display font-semibold text-foreground group-hover:text-primary">
                  {next.title}
                </span>
              </Link>
            )}
          </nav>
        )}
      </article>

      <DocsToc />
    </div>
  );
}
