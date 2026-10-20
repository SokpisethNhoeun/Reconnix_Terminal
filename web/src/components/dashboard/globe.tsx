"use client";

import { useEffect, useRef } from "react";
import type { GlobeControls } from "@/lib/globe";

/**
 * Canvas wrapper for the three.js globe (§6.2). three is dynamically imported inside the effect
 * so it stays out of the first JS chunk. The loop pauses when the canvas is >200px off screen or
 * the tab is hidden.
 *
 * The canvas sits on top of a CSS glow and is always visible: it is transparent until the globe
 * draws, so the glow shows through while three/the data load (no empty hole), and the globe then
 * appears over it. On ready the glow fades out. This avoids any crossfade race — if WebGL is
 * unavailable the glow simply stays.
 */
export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let controls: GlobeControls | null = null;
    let cancelled = false;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || (coarse && window.innerWidth < 768);

    const onReady = () => {
      if (!cancelled && glowRef.current) glowRef.current.style.opacity = "0";
    };

    import("@/lib/globe")
      .then(({ mountGlobe }) => {
        if (cancelled || !canvasRef.current) return;
        try {
          controls = mountGlobe(canvasRef.current, { reducedMotion: reduce, lowPower, onReady });
        } catch {
          // WebGL unavailable: leave the CSS glow in place.
        }
      })
      .catch(() => {});

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!controls) return;
        if (entry.isIntersecting) controls.resume();
        else controls.pause();
      },
      { rootMargin: "200px" },
    );
    io.observe(canvas);
    const onVis = () => {
      if (!controls) return;
      if (document.hidden) controls.pause();
      else controls.resume();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      controls?.destroy();
    };
  }, []);

  return (
    <div className="dash-globe-wrap" aria-hidden>
      <div ref={glowRef} className="dash-globe-glow" />
      <canvas ref={canvasRef} className="dash-globe-canvas" style={{ opacity: 1 }} />
    </div>
  );
}
