"use client";

/* Re-reads the saved assessments every 10 s while the tab is visible, so a run going on in
   the TUI (or in the Terminal view) shows up without a reload. Click to pause. The refresh
   re-renders the server views and keeps client state, so an open terminal session and the
   chosen view survive it. Adapted from reconix-tui/web/src/components/layout/live-refresh.tsx. */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVERY_MS = 10_000;

export function LiveRefresh({ renderedAt, dir }: { renderedAt: string; dir: string }) {
  const router = useRouter();
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, EVERY_MS);
    return () => window.clearInterval(timer);
  }, [live, router]);

  return (
    <button
      type="button"
      aria-pressed={live}
      onClick={() => setLive((v) => !v)}
      title={live ? `Reading ${dir} every 10 seconds. Click to pause.` : `Paused. Click to read ${dir} every 10 seconds.`}
      className="dash-reveal hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-md font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
    >
      <span
        aria-hidden
        className={live ? "dash-livedot inline-block size-1.5 rounded-full" : "inline-block size-1.5 rounded-full bg-muted-foreground"}
      />
      <span>
        {live ? "Live" : "Paused"} · {renderedAt}
      </span>
    </button>
  );
}
