"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** For a plain left click on a same-page hash link (`#getting-started` on a docs page), return its target. */
function sameDocumentHashTarget(e: MouseEvent): HTMLElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const anchor = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) return null;
  try {
    return document.querySelector<HTMLElement>(url.hash);
  } catch {
    return null;
  }
}

/**
 * Smooth scrolling for the documentation (mounted by app/docs/layout.tsx only). Lenis runs on
 * native scroll (so `position: sticky` keeps working), is stepped by the GSAP ticker and pushes
 * every frame into ScrollTrigger (the docs' reading-progress bar). Renders nothing and is not
 * created under prefers-reduced-motion.
 *
 * Lenis only ever moves the window. The dashboard at / is not a window-scrolling page on a
 * desktop frame (its content area is the scroller), so it must never mount this: Lenis would
 * take every wheel event and move nothing.
 *
 * Same-page hash links (the docs' "On this page") have exactly one owner: a capture-phase click
 * listener updates the URL and glides to the target with Lenis, honouring the heading's
 * scroll-margin-top. `preventDefault` makes Next's <Link> bail, so it does not also jump there
 * with scrollIntoView. Cross-page hash links still navigate normally.
 *
 * This is the one client file that uses `useEffect` instead of `useGSAP`: the Lenis instance is
 * not a GSAP object.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: false, // driven by gsap.ticker below
      lerp: 0.1, // 0.08–0.15; higher = snappier
      smoothWheel: true,
      syncTouch: false, // keep touch native; mobile momentum is already smooth
      stopInertiaOnNavigate: true, // drop momentum when a link to another route is clicked
    });

    const onAnchorClick = (e: MouseEvent) => {
      const target = sameDocumentHashTarget(e);
      if (!target) return;
      e.preventDefault();
      history.pushState(null, "", `#${target.id}`);
      lenis.scrollTo(target); // honours the target's scroll-margin-top (scroll-mt-24 under the sticky nav)
    };
    window.addEventListener("click", onAnchorClick, true);

    lenis.on("scroll", () => ScrollTrigger.update());
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("click", onAnchorClick, true);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33); // GSAP default; keeps StrictMode double-mount tidy
      lenis.destroy(); // removes window listeners and the html classes
    };
  }, []);

  return null;
}
