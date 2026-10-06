"use client";

/* Re-reads the saved files every 10 s while the tab is visible, so a run going on in the
   TUI shows up here without a reload. Click to pause. */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Dot } from "../neu/chips";

const EVERY_MS = 10_000;

export function LiveRefresh({ renderedAt }: { renderedAt: string }) {
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
      className="pill cursor-pointer"
      aria-pressed={live}
      onClick={() => setLive((v) => !v)}
      title={live ? "Updates every 10 seconds. Click to pause." : "Paused. Click to update every 10 seconds."}
    >
      <Dot tone={live ? "ok" : "faint"} />
      {live ? `Live · updated ${renderedAt}` : `Paused · ${renderedAt}`}
    </button>
  );
}
