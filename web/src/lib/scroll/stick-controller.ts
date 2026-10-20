/* The DOM half of useStickToBottom (components/assistant/use-stick-to-bottom.ts): attaches to
   whichever element its ref is given, applies the rules in stick-rules.ts to its scroll events,
   and follows growth while holding on. Framework-free, so it runs in unit tests on a stand-in box.

   - Growth is followed at once: streamed text, a card, an image or a table that finishes loading
     (ResizeObserver on the box and its children), new nodes (MutationObserver), and the box
     itself getting shorter (the composer grew). Following always uses `behavior: "instant"`, so
     a `scroll-behavior: smooth` on the box can't turn it into a lag.
   - `scrollToBottom()` glides there (instantly under prefers-reduced-motion, or when asked with
     `{ instant: true }`, e.g. on opening a long saved conversation) and holds on; if more arrives
     during the glide, it re-aims at the new bottom.
   - Nothing can hide behind a sticky element at the bottom: following goes to the end of the
     scroll area, where an in-flow sticky footer sits after the last message, not over it.
   - `ref` is a callback ref that also carries `current`, so the box may be swapped (the welcome
     screen for the conversation) and is picked up again. One element at a time. */
import { distanceToBottom, EPSILON, nextStick, type ScrollMetrics, type StickState } from "./stick-rules";

/** The ref handed out: a callback ref that also carries `current`. */
export type StickRef<T extends HTMLElement> = ((node: T | null) => () => void) & { current: T | null };

export type ScrollToBottomOptions = { instant?: boolean };
/** Callable with no argument (so it can be an onClick handler as it is) or with options. */
export type ScrollToBottom = {
  (): void;
  (options: ScrollToBottomOptions): void;
};

type Options = {
  /** Called whenever "following" turns on or off (the hook's `atBottom`). */
  onPinned: (pinned: boolean) => void;
  /** Whether to jump instead of gliding (defaults to prefers-reduced-motion). */
  reducedMotion?: () => boolean;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    el.scrollTo({ top: m.scrollHeight - m.clientHeight, behavior: state.seeking ? "smooth" : "instant" });
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

  const scrollToBottom: ScrollToBottom = (options?: ScrollToBottomOptions) => {
    if (!el) return;
    // `=== true`: used as an onClick handler as it is, the argument is a click event
    const instant = options?.instant === true || reducedMotion();
    const m = metrics(el);
    setState({ pinned: true, seeking: !instant && distanceToBottom(m) > EPSILON, lastTop: m.scrollTop });
    el.scrollTo({ top: m.scrollHeight - m.clientHeight, behavior: instant ? "instant" : "smooth" });
  };

  return { ref, scrollToBottom, follow, state: () => state };
}
