"use client";

/* Where the AI Assistant lives: a stage over the frame beside the sidebar (over the top bar and the
   content area). Its layers, bottom to top:
     surface — the box the open/close animation grows out of the hero and shrinks back into:
               the fill (the stage's background) and the card (the chat panel's frame)
     globe   — the dashboard's own globe, carried here from the hero (use-globe.ts, motion-globe.ts):
               it sits on the card, behind the welcome text, at MOTION.globeOpacity
     front   — the chat (AssistantView), always full size; its pieces fade in as the surface lands
   The transition (motion.ts) and the breathing loops (breath.ts, [data-breath]) never animate the
   same property of the same element, so they never fight.

   It follows the address: when `view` becomes "assistant" it opens, when it leaves it closes, and
   it tells the Viewer which view to show (`setShown`). The dashboard stays on screen while the
   assistant animates in; while it is open the Overview stays laid out underneath with its parts
   hidden and inert, so closing grows straight back into it (scroll position kept). Opened from
   another view, the assistant crossfades in over it and closes back to it. A request during a
   transition kills the running timeline and animates on from wherever everything is. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { leaveAssistant, type View } from "@/components/dashboard/view-url";
import { useAssistant } from "./assistant-provider";
import { AssistantView } from "./assistant-view";
import { startBreath, stopBreath, untilPeak } from "./breath";
import { boxIn, clearParts, closeTimeline, fadeTimeline, findParts, type Layers, MOTION, openTimeline, resetLayers, setPartsOut } from "./motion";
import { aimAt, aimFrom, boxSpot, carryGlobe, globeSpot, homeGlobe, isCarried, placeAround, spotBox } from "./motion-globe";
import { holdGlobe, setGlobeAmbient, sharedGlobe, useSharedGlobe } from "./use-globe";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// The grow/shrink needs the fixed-height desktop frame (frame.css); elsewhere it crossfades.
const roomy = () => window.matchMedia("(min-width: 1280px) and (min-height: 760px)").matches;

type Phase = "closed" | "opening" | "open" | "closing";

export function AssistantStage({ view, shown, setShown }: { view: View; shown: View; setShown: (v: View) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const globeLayer = useRef<HTMLDivElement>(null);
  const globeBreath = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const timeline = useRef<gsap.core.Timeline | null>(null);
  const phase = useRef<Phase>(view === "assistant" ? "open" : "closed");
  const closingTo = useRef<View | null>(null);
  const shownNow = useRef(shown);
  const partsOut = useRef(false); // the dashboard's parts carry the open's styles
  const growPending = useRef(false); // close: show the Overview first, then shrink onto it
  const scrollPending = useRef<View | null>(null); // restore this view's scroll once shown
  // where each view was scrolled when the assistant opened over it: the content area (the
  // desktop frame's scroller) and the page (the scroller without the fixed-height frame)
  const scrolls = useRef<Partial<Record<View, { content: number; page: number }>>>({});
  const returnFocus = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(view === "assistant");

  const { messages } = useAssistant();
  const welcome = messages.length === 0; // B's welcome screen (with its globe slot)
  const welcomeNow = useRef(welcome);
  const globe = useSharedGlobe();

  // --- lookups ---------------------------------------------------------------------------
  const frame = () => stage.current?.closest<HTMLElement>(".dash-frame") ?? null;
  const scroller = () => frame()?.querySelector<HTMLElement>(".dash-content") ?? null;
  const layers = (): Layers | null => {
    const [s, f, c, g, h, fr] = [surface.current, fill.current, card.current, globeLayer.current, halo.current, front.current];
    if (!s || !f || !c || !g || !h || !fr) return null;
    return { surface: s, fill: f, card: c, globe: g, halo: h, front: fr, pieces: [...fr.querySelectorAll<HTMLElement>("[data-assistant-piece]")] };
  };
  const stageBox = () => ({ left: 0, top: 0, width: stage.current?.clientWidth ?? 0, height: stage.current?.clientHeight ?? 0 });
  const globeOpacity = () => (welcomeNow.current ? MOTION.globeOpacity : 0);
  /** Without the fixed-height frame the stage shares the content's grid row, so a view laid out
      under it (while it fades) would stretch it; hold it at its own height meanwhile. */
  const lockStage = (hold: boolean) => {
    const s = stage.current;
    if (!s) return;
    const h = hold && !roomy() ? parseFloat(getComputedStyle(s).minHeight) : 0;
    if (h > 0) Object.assign(s.style, { height: `${h}px`, alignSelf: "start" });
    else {
      s.style.removeProperty("height");
      s.style.removeProperty("align-self");
    }
  };
  const restoreScroll = (v: View) => {
    const saved = scrolls.current[v];
    if (!saved) return;
    const el = scroller();
    if (el) el.scrollTop = saved.content;
    if (window.scrollY !== saved.page) window.scrollTo({ top: saved.page, behavior: "instant" });
  };

  // --- the globe while the assistant is open ---------------------------------------------
  /** Put the globe where the open assistant wants it: on its spot (carried in if it is still
      at home), at the welcome's opacity. "follow" only moves it (resize, scroll); "fade" also
      fades it in or out (the conversation started, New chat, the open just landed). */
  const aimGlobe = (how: "follow" | "fade") => {
    const g = sharedGlobe();
    const s = stage.current;
    const l = layers();
    const b = globeBreath.current;
    if (!g || !s || !l || !b) return;
    const opacity = globeOpacity();
    const carried = isCarried(g, b);
    if (!carried && opacity === 0) return; // nothing to show; it can stay in the hero
    const spot = globeSpot(s, l.front);
    if (!carried) {
      gsap.killTweensOf(g.carrier);
      carryGlobe(g, b, spotBox(spot), 0, MOTION.globeMask.stage);
    }
    const visible = Number(gsap.getProperty(g.carrier, "opacity")) > 0.01;
    if (how === "follow" || opacity > 0 || !visible) {
      const aim = aimAt(g.carrier, spot, opacity);
      placeAround(spot, l.halo, b);
      if (how === "fade" && visible) gsap.to(g.carrier, { x: aim.x, y: aim.y, scale: aim.scale, duration: MOTION.globeShift, ease: "power2.out", overwrite: "auto" });
      else gsap.set(g.carrier, { x: aim.x, y: aim.y, scale: aim.scale });
    }
    if (how === "follow") return;
    const duration = reducedMotion() ? MOTION.fadeReduced.duration : MOTION.globeFade;
    if (opacity > 0) holdGlobe("faded", false);
    gsap.to(g.carrier, { opacity, duration, ease: "power2.inOut", overwrite: "auto", onComplete: () => holdGlobe("faded", opacity === 0) });
    gsap.to(l.halo, { opacity: opacity > 0 ? 1 : 0, duration, ease: "power2.inOut", overwrite: "auto" });
  };

  // --- breathing ---------------------------------------------------------------------------
  const startBreathing = () => {
    const f = frame();
    if (f) startBreath(f, untilPeak(MOTION.breath.lead));
  };
  const stopBreathing = () => {
    const f = frame();
    if (f) stopBreath(f, MOTION.breath.settle);
  };

  // --- open ----------------------------------------------------------------------------------
  const settleOpen = () => {
    timeline.current = null;
    phase.current = "open";
    const f = frame();
    const l = layers();
    const s = stage.current;
    if (!f || !l || !s) return;
    gsap.set(l.surface, { clearProps: "left,top,width,height,borderRadius" }); // CSS: the whole stage
    gsap.set(l.pieces, { clearProps: "transform" });
    setShown("assistant");
    // the Overview stays laid out underneath; its parts wait where a close can grow back from
    if (!partsOut.current && roomy() && !reducedMotion()) {
      setPartsOut(findParts(f));
      partsOut.current = true;
    }
    aimGlobe("fade");
    setGlobeAmbient(true);
    startBreathing();
    composer.current?.focus({ preventScroll: true });
  };

  const open = (from: View) => {
    const f = frame();
    const l = layers();
    const s = stage.current;
    const b = globeBreath.current;
    if (!f || !l || !s || !b) return;
    const interrupted = timeline.current !== null;
    timeline.current?.kill();
    timeline.current = null;
    if (!interrupted) {
      const active = document.activeElement;
      returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
      scrolls.current[from] = { content: scroller()?.scrollTop ?? 0, page: window.scrollY };
    }
    phase.current = "opening";
    closingTo.current = null;
    s.setAttribute("data-on", ""); // now, not on React's next render: the first frame needs it
    setOn(true);
    l.front.style.pointerEvents = "";
    holdGlobe("faded", false);

    const parts = findParts(f);
    const to = stageBox();
    const g = sharedGlobe();
    if (g) gsap.killTweensOf([g.carrier, l.halo]); // a fade of the welcome's globe, say
    const hero = shownNow.current === "overview" ? boxIn(parts.hero, s) : null;
    if (hero && roomy() && !reducedMotion()) {
      partsOut.current = true;
      let aim = null;
      if (g) {
        const spot = globeSpot(s, l.front);
        placeAround(spot, l.halo, b);
        if (isCarried(g, b)) aim = aimAt(g.carrier, spot, globeOpacity());
        else {
          const home = boxIn(g.home, s);
          // it leaves the hero (into the stage, above it) only as it starts to move
          if (home) aim = { ...aimFrom(g.carrier, home, spot, globeOpacity()), before: () => carryGlobe(g, b, home, 1, MOTION.globeMask.hero) };
        }
      }
      timeline.current = openTimeline({ parts, layers: l, from: hero, to, fresh: !interrupted, globe: aim, onComplete: settleOpen });
      return;
    }
    // crossfade: from another view, on phones and tablets, or with reduced motion
    if (!roomy()) {
      lockStage(true);
      // the page scrolls here: the stage is laid out to fill the screen from the top
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" });
    }
    let fadeIn = null;
    if (g && globeOpacity() > 0 && boxIn(g.home, s) === null) {
      // its hero isn't on screen: bring it in with the assistant (else it moves once covered)
      const spot = globeSpot(s, l.front);
      if (!isCarried(g, b)) carryGlobe(g, b, spotBox(spot), 0, MOTION.globeMask.stage);
      placeAround(spot, l.halo, b);
      const aim = aimAt(g.carrier, spot, globeOpacity());
      gsap.set(g.carrier, { x: aim.x, y: aim.y, scale: aim.scale });
      fadeIn = { carrier: g.carrier, opacity: aim.opacity };
    }
    timeline.current = fadeTimeline({ layers: l, show: true, fresh: !interrupted, to, reduced: reducedMotion(), globe: fadeIn, onComplete: settleOpen });
  };

  // --- close ---------------------------------------------------------------------------------
  const settleClose = () => {
    timeline.current = null;
    phase.current = "closed";
    closingTo.current = null;
    const f = frame();
    const l = layers();
    const s = stage.current;
    const g = sharedGlobe();
    if (g) homeGlobe(g);
    setGlobeAmbient(false);
    holdGlobe("faded", false);
    if (f && partsOut.current) clearParts(findParts(f));
    partsOut.current = false;
    if (l) {
      resetLayers(l);
      l.front.style.pointerEvents = "";
    }
    if (globeBreath.current) gsap.set(globeBreath.current, { clearProps: "transform,transformOrigin" });
    lockStage(false);
    s?.removeAttribute("data-on");
    setOn(false);
    // focus goes back to the opener when it was in the assistant (or lost), else stays put
    const active = document.activeElement;
    if (!active || active === document.body || s?.contains(active)) {
      const back = returnFocus.current;
      const shownOk = (el: HTMLElement | null | undefined): el is HTMLElement =>
        !!el && el.isConnected && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden";
      const fallback = f?.querySelector<HTMLElement>('nav [data-view="assistant"]');
      (shownOk(back) ? back : fallback)?.focus({ preventScroll: true });
    }
    returnFocus.current = null;
  };

  /** Shrink onto the hero (the Overview is laid out and shown by now). */
  const growBack = () => {
    const f = frame();
    const l = layers();
    const s = stage.current;
    const b = globeBreath.current;
    if (!f || !l || !s || !b) return;
    const parts = findParts(f);
    restoreScroll("overview");
    const hero = boxIn(parts.hero, s);
    if (!hero) {
      // nothing to grow back into after all: fade out over it
      if (partsOut.current) clearParts(parts);
      partsOut.current = false;
      timeline.current = fadeTimeline({ layers: l, show: false, fresh: false, to: stageBox(), reduced: reducedMotion(), globe: null, onComplete: settleClose });
      return;
    }
    const g = sharedGlobe();
    let aim = null;
    if (g && isCarried(g, b)) {
      gsap.killTweensOf([g.carrier, l.halo]);
      const home = boxIn(g.home, s);
      // back over its place in the hero, then into it (under the hero's cards) as it lands
      if (home) aim = { ...aimAt(g.carrier, boxSpot(home), 1, MOTION.globeMask.hero), after: () => homeGlobe(g) };
    }
    timeline.current = closeTimeline({ parts, layers: l, to: hero, globe: aim, onComplete: settleClose });
  };

  const close = (to: View) => {
    const f = frame();
    const l = layers();
    const s = stage.current;
    const b = globeBreath.current;
    if (!f || !l || !s || !b) return;
    const interrupted = timeline.current !== null;
    timeline.current?.kill();
    timeline.current = null;
    stopBreathing();
    setGlobeAmbient(false);
    holdGlobe("faded", false);
    phase.current = "closing";
    closingTo.current = to;
    l.front.style.pointerEvents = "none"; // the dashboard coming back takes the clicks
    const parts = findParts(f);
    const g = sharedGlobe();

    if (to === "overview" && roomy() && !reducedMotion()) {
      // the parts wait where the open left them (unless they are on their way already)
      if (!interrupted || !partsOut.current) setPartsOut(parts);
      partsOut.current = true;
      if (shownNow.current === "overview" || shownNow.current === "assistant") {
        setShown("overview");
        growBack(); // the Overview is laid out underneath already: measure it now
      } else {
        growPending.current = true; // it was hidden (closing to another view): show it first
        setShown("overview");
      }
      return;
    }
    // crossfade back to `to`
    lockStage(true);
    if (partsOut.current) clearParts(parts);
    partsOut.current = false;
    if (to === "overview" && g && isCarried(g, b)) homeGlobe(g); // its hero shows through the fade
    scrollPending.current = to;
    setShown(to);
    timeline.current = fadeTimeline({ layers: l, show: false, fresh: false, to: stageBox(), reduced: reducedMotion(), globe: null, onComplete: settleClose });
  };

  // --- following the address ---------------------------------------------------------------
  const follow = (v: View) => {
    const p = phase.current;
    if (v === "assistant") {
      if (p === "closed" || p === "closing") open(shownNow.current);
    } else if (p === "open" || p === "opening") close(v);
    else if (p === "closing") {
      if (closingTo.current !== v) close(v); // retarget the close
    } else setShown(v); // an ordinary view switch
  };

  // Handled one frame later, so a Back that lands and a view opened right after it (the sidebar
  // leaving the assistant: back, then replace) count as one change.
  useEffect(() => {
    const id = requestAnimationFrame(() => follow(view));
    return () => cancelAnimationFrame(id);
    // follow reads refs only; it must not re-run when its identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // after the Viewer has shown what was asked for
  useLayoutEffect(() => {
    shownNow.current = shown;
    if (shown === "assistant") lockStage(false); // nothing is laid out under it any more
    if (scrollPending.current === shown) {
      scrollPending.current = null;
      restoreScroll(shown);
    }
    if (shown === "overview" && growPending.current) {
      growPending.current = false;
      growBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // opened directly (a link, a reload): no box to grow from, just the open state
  useEffect(() => {
    if (phase.current !== "open") return;
    const f = frame();
    if (f && roomy() && !reducedMotion()) {
      setPartsOut(findParts(f));
      partsOut.current = true;
    }
    aimGlobe("fade");
    setGlobeAmbient(true);
    startBreathing();
    composer.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the globe mounted (or loaded) after the assistant opened
  useEffect(() => {
    if (globe && phase.current === "open") aimGlobe("fade");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globe]);

  // the conversation started (the globe fades out and stops drawing) or was cleared (back in)
  useEffect(() => {
    welcomeNow.current = welcome;
    if (phase.current === "open") aimGlobe("fade");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);

  // while the welcome shows, the globe follows its slot (resizes, scrolling)
  useEffect(() => {
    const s = stage.current;
    const fr = front.current;
    if (!on || !welcome || !s || !fr) return;
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (phase.current === "open" && welcomeNow.current) aimGlobe("follow");
      });
    };
    const ro = new ResizeObserver(later);
    ro.observe(s);
    const slot = fr.querySelector("[data-globe-slot]");
    if (slot) ro.observe(slot);
    fr.addEventListener("scroll", later, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      fr.removeEventListener("scroll", later, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, welcome]);

  useEffect(() => () => void timeline.current?.kill(), []);

  return (
    <div ref={stage} className="dash-assistant-stage" data-on={on ? "" : undefined} inert={!on} aria-hidden={!on}>
      <div ref={surface} className="dash-assistant-surface" aria-hidden>
        <div ref={fill} className="dash-assistant-fill" />
        <div ref={card} className="dash-assistant-card" data-breath="scale">
          <div className="dash-assistant-glow" data-breath="glow" />
        </div>
      </div>
      <div ref={globeLayer} className="dash-assistant-globe" aria-hidden>
        <div ref={globeBreath} className="dash-assistant-globe-breath" data-breath="scale">
          <div ref={halo} className="dash-assistant-halo">
            <div className="dash-assistant-halo-glow" data-breath="glow" />
          </div>
          {/* the dashboard's globe is carried in here while the assistant is open */}
        </div>
      </div>
      <div ref={front} className="dash-assistant-front">
        <div className="dash-assistant-panel" data-breath="scale">
          <AssistantView ref={composer} onMinimize={() => leaveAssistant()} />
        </div>
      </div>
    </div>
  );
}
