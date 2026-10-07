"use client";

/* Asks before the tab is closed or reloaded while `active` (a live terminal session would
   end with it; its saved copy stays). */
import { useEffect } from "react";

export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
