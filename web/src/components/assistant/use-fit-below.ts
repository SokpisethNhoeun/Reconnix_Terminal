"use client";

/* Keeps a header menu's panel inside the assistant's surface: its height is capped to the room
   between its top and the bottom of the assistant view (or the window), so its own list scrolls
   and its footer (Save, Add model) stays reachable on a phone. Measured while it is open, again
   when `key` changes (another panel content) and on resize. */
import { useLayoutEffect } from "react";

const MARGIN = 12;
const MIN = 220;
const MAX = 640;

/** The height that fits `el` between its top and the assistant view's bottom. */
function roomBelow(el: HTMLElement): number {
  const top = el.getBoundingClientRect().top;
  const view = el.closest(".ai-view")?.getBoundingClientRect();
  const bottom = Math.min(window.innerHeight, view?.bottom ?? window.innerHeight);
  return Math.round(Math.min(MAX, Math.max(MIN, bottom - top - MARGIN)));
}

export function useFitBelow(panel: React.RefObject<HTMLElement | null>, open: boolean, key: unknown) {
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    const fit = () => el.style.setProperty("max-height", `${roomBelow(el)}px`);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [panel, open, key]);
}
