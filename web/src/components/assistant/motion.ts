/* The dashboard ↔ assistant transition, as GSAP timelines (the intro uses GSAP too). Open: the
   top bar goes up, the left card left, the right column right, the bottom row down, all fading,
   while the surface grows from the hero's box (globe + Ask bar) to the whole stage and the
   assistant's pieces fade up as it settles. Close is the same in reverse. Every tween goes *to*
   a value, so a timeline started mid-way carries on from where things are. Adjust the feel here. */
import { gsap } from "gsap";

export const MOTION = {
  ease: "power3.inOut",
  travel: 96, // px the side panels move as they leave
  groupDuration: 0.48,
  stagger: 0.045, // between top, left, right and bottom
  surfaceAt: 0.04,
  surfaceDuration: 0.62,
  piecesAt: 0.42, // header, messages, composer
  pieceStagger: 0.05,
  pieceDuration: 0.28, // open ≈ 0.42 + 2 × 0.05 + 0.28 = 0.8 s
  closeDuration: 0.58,
  fade: 0.24, // the plain fade (no dashboard to grow from, phones)
  fadeReduced: 0.12, // reduced motion: a short fade only
} as const;

export type Box = { left: number; top: number; width: number; height: number };

export interface Parts {
  topbar: HTMLElement | null;
  left: HTMLElement | null;
  right: HTMLElement | null;
  bottom: HTMLElement | null;
  hero: HTMLElement[]; // the title and the Ask bar: they fade where they are
  globe: HTMLElement | null;
}

export function findParts(frame: HTMLElement): Parts {
  const one = (s: string) => frame.querySelector<HTMLElement>(s);
  return {
    topbar: one(".dash-topbar"),
    left: one(".dash-timeline-card"),
    right: one(".dash-right"),
    bottom: one(".dash-bottom"),
    hero: [one(".dash-hero-title"), one(".dash-askbar")].filter((e): e is HTMLElement => e !== null),
    globe: one(".dash-globe-wrap"),
  };
}

/** `el`'s box relative to `stage`, or null when it isn't laid out (hidden). */
export function boxIn(el: Element | null, stage: HTMLElement): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const s = stage.getBoundingClientRect();
  return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
}

const all = (p: Parts) => [p.topbar, p.left, p.right, p.bottom, p.globe, ...p.hero].filter((e): e is HTMLElement => e !== null);

/** The dashboard parts where the open animation leaves them. */
export function setPartsOut(p: Parts): void {
  const t = MOTION.travel;
  if (p.topbar) gsap.set(p.topbar, { yPercent: -110, opacity: 0 });
  if (p.left) gsap.set(p.left, { x: -t, opacity: 0 });
  if (p.right) gsap.set(p.right, { x: t, opacity: 0 });
  if (p.bottom) gsap.set(p.bottom, { y: t, opacity: 0 });
  if (p.globe) gsap.set(p.globe, { scale: 0.86, opacity: 0 });
  gsap.set(p.hero, { opacity: 0 });
}

export function clearParts(p: Parts): void {
  gsap.set(all(p), { clearProps: "transform,opacity" });
}

export interface Layers {
  surface: HTMLElement;
  fill: HTMLElement;
  panel: HTMLElement;
  pieces: HTMLElement[];
}

/** Open: the dashboard leaves and the surface grows from `from` to `to`. */
export function openTimeline(p: Parts, l: Layers, from: Box | null, to: Box, fresh: boolean, onComplete: () => void): gsap.core.Timeline {
  const m = MOTION;
  if (fresh) {
    gsap.set(l.surface, { ...(from ?? to), borderRadius: 16 });
    gsap.set(l.fill, { opacity: 0 });
    gsap.set(l.panel, { opacity: 0 });
    gsap.set(l.pieces, { opacity: 0, y: 14 });
  }
  const tl = gsap.timeline({ defaults: { ease: m.ease }, onComplete });
  if (p.topbar) tl.to(p.topbar, { yPercent: -110, opacity: 0, duration: m.groupDuration }, 0);
  if (p.left) tl.to(p.left, { x: -m.travel, opacity: 0, duration: m.groupDuration }, m.stagger);
  if (p.right) tl.to(p.right, { x: m.travel, opacity: 0, duration: m.groupDuration }, m.stagger * 2);
  if (p.bottom) tl.to(p.bottom, { y: m.travel, opacity: 0, duration: m.groupDuration }, m.stagger * 3);
  if (p.hero.length) tl.to(p.hero, { opacity: 0, duration: 0.24, ease: "power2.out" }, 0);
  if (p.globe) tl.to(p.globe, { scale: 0.86, opacity: 0, duration: m.surfaceDuration }, m.surfaceAt);
  tl.to(l.surface, { ...to, borderRadius: 0, duration: m.surfaceDuration }, m.surfaceAt);
  tl.to(l.fill, { opacity: 1, duration: m.surfaceDuration * 0.75 }, m.surfaceAt + 0.08);
  tl.to(l.panel, { opacity: 1, duration: 0.3, ease: "power2.out" }, m.surfaceAt + 0.22);
  tl.to(l.pieces, { opacity: 1, y: 0, duration: m.pieceDuration, stagger: m.pieceStagger, ease: "power2.out" }, m.piecesAt);
  return tl;
}

/** Close: the surface shrinks back to `to` (the hero's box) and the dashboard returns. */
export function closeTimeline(p: Parts, l: Layers, to: Box, onComplete: () => void): gsap.core.Timeline {
  const m = MOTION;
  const tl = gsap.timeline({ defaults: { ease: m.ease }, onComplete });
  tl.to(l.pieces, { opacity: 0, y: 10, duration: 0.18, stagger: 0.03, ease: "power2.in" }, 0);
  tl.to(l.panel, { opacity: 0, duration: 0.22, ease: "power2.in" }, 0.1);
  tl.to(l.surface, { ...to, borderRadius: 16, duration: m.closeDuration }, 0.06);
  tl.to(l.fill, { opacity: 0, duration: m.closeDuration * 0.7 }, 0.22);
  if (p.globe) tl.to(p.globe, { scale: 1, opacity: 1, duration: m.closeDuration }, 0.12);
  if (p.bottom) tl.to(p.bottom, { y: 0, opacity: 1, duration: m.groupDuration }, 0.16);
  if (p.right) tl.to(p.right, { x: 0, opacity: 1, duration: m.groupDuration }, 0.16 + m.stagger);
  if (p.left) tl.to(p.left, { x: 0, opacity: 1, duration: m.groupDuration }, 0.16 + m.stagger * 2);
  if (p.topbar) tl.to(p.topbar, { yPercent: 0, opacity: 1, duration: m.groupDuration }, 0.16 + m.stagger * 3);
  if (p.hero.length) tl.to(p.hero, { opacity: 1, duration: 0.3, ease: "power2.out" }, 0.42);
  return tl;
}

/** The plain fade: the surface fills the stage; it fades in (or out). */
export function fadeTimeline(l: Layers, show: boolean, reduced: boolean, onComplete: () => void): gsap.core.Timeline {
  const d = reduced ? MOTION.fadeReduced : MOTION.fade;
  const tl = gsap.timeline({ onComplete });
  if (show) {
    gsap.set(l.surface, { clearProps: "left,top,width,height,borderRadius" });
    gsap.set([l.fill, l.panel], { opacity: 1 });
    tl.fromTo(l.surface, { opacity: 0 }, { opacity: 1, duration: d, ease: "power2.out" });
    if (!reduced) tl.fromTo(l.pieces, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.24, stagger: 0.04, ease: "power2.out" }, 0.06);
  } else {
    tl.to(l.surface, { opacity: 0, duration: d, ease: "power2.in" });
  }
  return tl;
}
