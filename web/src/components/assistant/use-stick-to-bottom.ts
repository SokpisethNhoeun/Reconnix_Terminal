"use client";

/* Keeps a scrolling box (the conversation) on its newest content while the reader is at the
   bottom, and leaves them alone once they scroll up: then `atBottom` is false and the page offers
   "↓ New messages" (scroll-to-bottom.tsx), whose click calls `scrollToBottom()`.

     const { ref, atBottom, scrollToBottom } = useStickToBottom<HTMLDivElement>();
     <div ref={ref} role="log" className="min-h-0 flex-1 overflow-y-auto">…</div>
     <ScrollToBottom show={!atBottom} onClick={scrollToBottom} />

   The rules (pure, in `nextStick`, unit-tested in tests/stick-to-bottom.test.ts):
   - Any scroll UP that leaves the very bottom lets go, even a small one: the reader is reading.
     Only the reader moves the box up; following new content only ever moves it down, and a box
     that shrinks clamps to the bottom, which is not "up" in this sense.
   - Coming back down to within NEAR_PX of the bottom holds on again.
   - While held, every growth is followed at once: streamed text, a card, an image or a table
     that finishes loading (ResizeObserver on the box and its children), new nodes
     (MutationObserver), and the box itself getting shorter (the composer grew).
   - `scrollToBottom()` glides there (instantly under prefers-reduced-motion) and holds on; if
     more arrives during the glide, it re-aims at the new bottom.
   Nothing can hide behind a sticky element at the bottom: following goes to the end of the
   scroll area, where an in-flow sticky footer sits after the last message, not over it.

   `ref` works both as a callback ref and as an object ref (`ref.current`), so the box may be
   swapped (the welcome screen for the conversation) and is picked up again. Passing it to
   several elements at once is not supported. */
import { useState } from "react";

/** Within this many pixels of the bottom, scrolling down holds on to the bottom again. */
export const NEAR_PX = 48;
/** Rounding: a box this close to its end is at the end (fractional zoom, subpixel layout). */
const EPSILON = 1;

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };
/** `pinned`: follow new content. `seeking`: a smooth scrollToBottom() is on its way down. */
export type StickState = { pinned: boolean; seeking: boolean; lastTop: number };

export const distanceToBottom = (m: ScrollMetrics) => Math.max(0, m.scrollHeight - m.clientHeight - m.scrollTop);

/** What one scroll event means for the state. Pure. */
export function nextStick(s: StickState, m: ScrollMetrics): StickState {
  const gap = distanceToBottom(m);
  const top = m.scrollTop;
  if (gap <= EPSILON) return { pinned: true, seeking: false, lastTop: top }; // at the end
  if (top < s.lastTop - EPSILON) return { pinned: false, seeking: false, lastTop: top }; // the reader went up
  if (top > s.lastTop + EPSILON && gap <= NEAR_PX) return { pinned: true, seeking: s.seeking, lastTop: top }; // back down
  return { ...s, lastTop: top };
}

/** The ref handed out: a callback ref that also carries `current`. */
export type StickRef<T extends HTMLElement> = ((node: T | null) => () => void) & { current: T | null };

type Options = {
  /** Called whenever "following" turns on or off (the hook's `atBottom`). */
  onPinned: (pinned: boolean) => void;
  /** Whether to jump instead of gliding (defaults to prefers-reduced-motion). */
  reducedMotion?: () => boolean;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The framework-free part, one per hook: attaches to whichever element the ref is given. */
export function createStickToBottom<T extends HTMLElement>({ onPinned, reducedMotion = prefersReducedMotion }: Options) {
  let el: T | null = null;
  let state: StickState = { pinned: true, seeking: false, lastTop: 0 };
  let detach: (() => void) | null = null;

  const setState = (next: StickState) => {
    const changed = next.pinned !== state.pinned;
    state = next;
    if (changed) onPinned(next.pinned);
  };
  const metrics = (box: T): ScrollMetrics => ({ scrollTop: box.scrollTop, scrollHeight: box.scrollHeight, clientHeight: box.clientHeight });

  /** Content or size changed: if holding on and not at the end, go there. */
  const follow = () => {
    if (!el || !state.pinned) return;
    const m = metrics(el);
    if (distanceToBottom(m) <= EPSILON) return;
    const top = m.scrollHeight - m.clientHeight;
    // `instant`, not `auto`: a `scroll-behavior: smooth` on the box must not turn following into a lag
    el.scrollTo({ top, behavior: state.seeking ? "smooth" : "instant" });
  };

  const attach = (box: T) => {
    const onScroll = () => setState(nextStick(state, metrics(box)));
    box.addEventListener("scroll", onScroll, { passive: true });

    let frame = 0;
    const later = () => {
      if (typeof requestAnimationFrame !== "function") return follow();
      if (frame) return; // one check per frame, however many nodes changed
      frame = requestAnimationFrame(() => {
        frame = 0;
        follow();
      });
    };
    // Sizes: the box (it shrinks when the composer grows) and each of its children (streamed
    // text, cards, images and tables that finish loading). RO runs after layout, before paint.
    const sizes = typeof ResizeObserver === "function" ? new ResizeObserver(() => follow()) : null;
    const watched = new Set<Element>();
    const watchChildren = () => {
      if (!sizes) return;
      for (const child of Array.from(box.children)) {
        if (!watched.has(child)) {
          sizes.observe(child);
          watched.add(child);
        }
      }
      for (const child of watched) {
        if (child.parentElement !== box) {
          sizes.unobserve(child);
          watched.delete(child);
        }
      }
    };
    sizes?.observe(box);
    watchChildren();
    // Nodes: new children to measure, and any change deeper down that RO might not see.
    const nodes =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            watchChildren();
            later();
          })
        : null;
    nodes?.observe(box, { childList: true, subtree: true, characterData: true });

    state = { pinned: true, seeking: false, lastTop: box.scrollTop };
    onPinned(true);
    follow();

    return () => {
      box.removeEventListener("scroll", onScroll);
      sizes?.disconnect();
      nodes?.disconnect();
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
  };

  // React 19 calls the cleanup a ref callback returns instead of ref(null) when the element goes.
  const release = (node: T | null) => () => {
    if (el !== node) return;
    detach?.();
    detach = null;
    el = null;
    ref.current = null;
  };
  const ref = ((node: T | null) => {
    if (node !== el) {
      detach?.();
      detach = null;
      el = node;
      ref.current = node;
      if (node) detach = attach(node);
    }
    return release(node);
  }) as StickRef<T>;
  ref.current = null;

  const scrollToBottom = () => {
    if (!el) return;
    const instant = reducedMotion();
    const m = metrics(el);
    setState({ pinned: true, seeking: !instant && distanceToBottom(m) > EPSILON, lastTop: m.scrollTop });
    el.scrollTo({ top: m.scrollHeight - m.clientHeight, behavior: instant ? "instant" : "smooth" });
  };

  return { ref, scrollToBottom, follow, state: () => state };
}

export function useStickToBottom<T extends HTMLElement = HTMLDivElement>(): {
  ref: StickRef<T>;
  atBottom: boolean;
  scrollToBottom: () => void;
} {
  const [atBottom, setAtBottom] = useState(true);
  // created once; setAtBottom is stable
  const [stick] = useState(() => createStickToBottom<T>({ onPinned: setAtBottom }));
  return { ref: stick.ref, atBottom, scrollToBottom: stick.scrollToBottom };
}
