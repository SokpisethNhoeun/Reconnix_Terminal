"use client";

/* Focus around the assistant (plan §6, point 5):
   - the opener: the element that had focus, or, for a click on something that can't take it
     (the Ask bar's background), the field it belongs to;
   - on open: the composer, unless the user moved focus elsewhere meanwhile or it is disabled;
   - on close: back to the opener when focus was in the assistant (or lost), else left alone. */
import { type RefObject, useCallback, useEffect, useRef } from "react";

const FOCUSABLE = "button, a[href], input, textarea, select, [tabindex]:not([tabindex='-1'])";
const FIELD = "input:not([type=hidden]):not([disabled]), textarea:not([disabled])";
const RECENT_MS = 1000; // a pointerdown older than this didn't open it (Back, Forward…)

const shownOk = (el: HTMLElement | null | undefined): el is HTMLElement =>
  !!el && el.isConnected && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden";

/** What a pointerdown on `target` meant to focus: itself or its control, else the text field of
    the card it is on (a few levels up, within its view). */
function focusTarget(target: Element): HTMLElement | null {
  const own = target.closest<HTMLElement>(FOCUSABLE);
  if (own) return own;
  let el: Element | null = target;
  for (let up = 0; el && up < 6 && !el.matches("[data-view-pane], .dash-frame"); up++, el = el.parentElement) {
    const field = el.querySelector<HTMLElement>(FIELD);
    if (field) return field;
  }
  return null;
}

export function useReturnFocus(stage: RefObject<HTMLElement | null>) {
  const opener = useRef<HTMLElement | null>(null);
  const pointer = useRef<{ target: Element; at: number } | null>(null);

  useEffect(() => {
    const note = (e: PointerEvent) => {
      if (e.target instanceof Element) pointer.current = { target: e.target, at: performance.now() };
    };
    document.addEventListener("pointerdown", note, true);
    return () => document.removeEventListener("pointerdown", note, true);
  }, []);

  /** As the assistant starts to open: who opened it. */
  const remember = useCallback(() => {
    const s = stage.current;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !s?.contains(active)) {
      opener.current = active;
      return;
    }
    const p = pointer.current;
    const recent = p && performance.now() - p.at < RECENT_MS && !s?.contains(p.target);
    opener.current = recent ? focusTarget(p.target) : null;
  }, [stage]);

  /** As the open lands: the composer, if focus is still where the open left it. */
  const focusComposer = useCallback(
    (composer: HTMLTextAreaElement | null) => {
      const s = stage.current;
      const active = document.activeElement;
      const free = !active || active === document.body || active === opener.current || !!s?.contains(active);
      if (free && composer && !composer.disabled) composer.focus({ preventScroll: true });
    },
    [stage],
  );

  /** As the close lands: back to the opener (or `fallback`) if focus was in the assistant or lost. */
  const restore = useCallback(
    (fallback: HTMLElement | null) => {
      const s = stage.current;
      const active = document.activeElement;
      const back = opener.current;
      opener.current = null;
      if (active && active !== document.body && !s?.contains(active)) return; // the user put it somewhere
      (shownOk(back) ? back : fallback)?.focus({ preventScroll: true });
    },
    [stage],
  );

  return { remember, focusComposer, restore };
}
