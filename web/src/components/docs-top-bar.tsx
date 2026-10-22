import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

/**
 * The top bar on the docs pages, in the dashboard's frame: what this tab is, and the way back to
 * the dashboard. The docs search lives in the docs sidebar (one search box per page). Server
 * component.
 */
export function DocsTopBar() {
  return (
    <header className="dash-topbar relative z-30 flex min-w-0 items-center gap-3 border-b border-border px-3 sm:px-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-border bg-card text-primary">
        <BookOpen className="size-4" strokeWidth={1.6} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">Documentation</span>
        <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:block">The Reconix terminal, every command and key</span>
      </span>
      <Link
        href="/"
        className="ml-auto inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Dashboard
      </Link>
    </header>
  );
}
