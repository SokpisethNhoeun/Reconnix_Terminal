"use client";

/* Keeps a scrolling box (the conversation) on its newest content while the reader is near the
   bottom. Once they scroll up it stays where they are and reports `atBottom: false`, so the page
   can offer a "↓ New messages" control (scroll-to-bottom.tsx). New and growing content
   (streamed text) is noticed with a MutationObserver, so callers pass no dependencies. */
import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_PX = 48; // this close to the bottom counts as "at the bottom"

export function useStickToBottom<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_PX;
      pinned.current = near;
      setAtBottom(near);
    };
    const follow = () => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const watch = new MutationObserver(follow);
    watch.observe(el, { childList: true, subtree: true, characterData: true });
    follow();
    return () => {
      el.removeEventListener("scroll", onScroll);
      watch.disconnect();
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setAtBottom(true);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  return { ref, atBottom, scrollToBottom };
}
