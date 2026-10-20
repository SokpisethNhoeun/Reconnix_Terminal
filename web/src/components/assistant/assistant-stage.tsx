"use client";

/* Where the AI Assistant lives: a stage over the frame beside the sidebar (the top bar and the
   content area), holding the surface the open/close animation moves (motion.ts) and, inside it,
   the panel that breathes once the assistant has settled. Two layers, so the transition's
   transforms and the breathing loop never fight.

   It follows the address: when `view` becomes "assistant" it opens, when it leaves it closes,
   and it tells the Viewer which view to show (`setShown`) once a transition lands, so the
   dashboard stays on screen while it animates away. A new request mid-transition kills the
   running timeline and animates on from where everything is. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { leaveAssistant, type View } from "@/components/dashboard/view-url";
import { AssistantView } from "./assistant-view";
import { useBreathPhase } from "./breath";
import { boxIn, clearParts, closeTimeline, fadeTimeline, findParts, type Layers, openTimeline, setPartsOut } from "./motion";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// The grow/shrink needs the fixed-height desktop frame; elsewhere the assistant fades.
const roomy = () => window.matchMedia("(min-width: 1280px) and (min-height: 760px)").matches;

export function AssistantStage({ view, shown, setShown }: { view: View; shown: View; setShown: (v: View) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const prevView = useRef(view);
  const shownNow = useRef(shown);
  const partsMoved = useRef(false); // the dashboard parts carry the open's transforms
  const closePending = useRef(false); // show the dashboard first, then shrink onto it
  const returnFocus = useRef<HTMLElement | null>(null);
  const contentScroll = useRef(0);
  const [on, setOn] = useState(view === "assistant");
  const [breathing, setBreathing] = useState(view === "assistant");
  const breath = useBreathPhase(breathing);

  const frame = () => stage.current?.closest<HTMLElement>(".dash-frame") ?? null;
  const layers = (): Layers | null => {
    if (!surface.current || !fill.current || !panel.current) return null;
    return { surface: surface.current, fill: fill.current, panel: panel.current, pieces: [...panel.current.querySelectorAll<HTMLElement>("[data-assistant-piece]")] };
  };
  const settleLayers = (l: Layers) => {
    l.surface.style.cssText = "";
    for (const el of [l.fill, l.panel, ...l.pieces]) {
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
      el.style.removeProperty("translate");
    }
  };

  const settleOpen = () => {
    timeline.current = null;
    const l = layers();
    if (l) settleLayers(l);
    setShown("assistant");
    setBreathing(true);
    composer.current?.focus({ preventScroll: true });
  };

  const settleClose = () => {
    timeline.current = null;
    const l = layers();
    if (l) settleLayers(l);
    const f = frame();
    if (f) clearParts(findParts(f));
    partsMoved.current = false;
    setOn(false);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back?.isConnected && back.offsetParent !== null) back.focus({ preventScroll: true });
  };

  const open = (from: View) => {
    const f = frame();
    const l = layers();
    if (!f || !l || !stage.current) return;
    const interrupted = timeline.current !== null;
    timeline.current?.kill();
    timeline.current = null;
    if (!interrupted) {
      returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      contentScroll.current = f.querySelector(".dash-content")?.scrollTop ?? 0;
    }
    setOn(true);
    if (from === "overview" && shownNow.current === "overview" && roomy() && !reducedMotion()) {
      const to = { left: 0, top: 0, width: stage.current.clientWidth, height: stage.current.clientHeight };
      partsMoved.current = true;
      timeline.current = openTimeline(findParts(f), l, boxIn(f.querySelector(".dash-hero"), stage.current), to, !interrupted, settleOpen);
    } else {
      timeline.current = fadeTimeline(l, true, reducedMotion(), settleOpen);
    }
  };

  const shrink = () => {
    const f = frame();
    const l = layers();
    if (!f || !l || !stage.current) return;
    const content = f.querySelector(".dash-content");
    if (content) content.scrollTop = contentScroll.current;
    const hero = boxIn(f.querySelector(".dash-hero"), stage.current) ?? { left: stage.current.clientWidth / 2 - 40, top: stage.current.clientHeight / 2 - 40, width: 80, height: 80 };
    timeline.current = closeTimeline(findParts(f), l, hero, settleClose);
  };

  const close = (to: View) => {
    const f = frame();
    const l = layers();
    if (!f || !l || !stage.current) return;
    setBreathing(false);
    const interrupted = timeline.current !== null;
    timeline.current?.kill();
    timeline.current = null;
    if (to === "overview" && roomy() && !reducedMotion()) {
      if (interrupted && shownNow.current === "overview") return shrink(); // still opening: turn around
      // fully open: put the dashboard where the open left it, show it, then shrink onto it
      setPartsOut(findParts(f));
      partsMoved.current = true;
      const { clientWidth: width, clientHeight: height } = stage.current;
      l.surface.style.cssText = `left:0;top:0;width:${width}px;height:${height}px;border-radius:0`;
      closePending.current = true;
      setShown("overview");
      return;
    }
    if (partsMoved.current) clearParts(findParts(f));
    partsMoved.current = false;
    setShown(to);
    timeline.current = fadeTimeline(l, false, reducedMotion(), settleClose);
  };

  // follow the address
  useEffect(() => {
    const before = prevView.current;
    prevView.current = view;
    if (before === view) return;
    if (view === "assistant") open(before);
    else if (before === "assistant") close(view);
    else {
      // another view while a transition still runs: land it at once
      if (timeline.current) {
        timeline.current.progress(1);
        timeline.current?.kill();
        timeline.current = null;
      }
      setShown(view);
    }
    // open/close read refs only; they must not re-run when their identities change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // after the Viewer has shown what was asked for
  useLayoutEffect(() => {
    shownNow.current = shown;
    const f = frame();
    if (shown === "assistant" && partsMoved.current && f) {
      clearParts(findParts(f)); // the dashboard is hidden now
      partsMoved.current = false;
    }
    if (shown === "overview" && closePending.current) {
      closePending.current = false;
      shrink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  useEffect(() => () => void timeline.current?.kill(), []);

  return (
    <div ref={stage} className="dash-assistant-stage" data-on={on ? "" : undefined} inert={!on} aria-hidden={!on}>
      <div ref={surface} className="dash-assistant-surface">
        <div ref={fill} className="dash-assistant-fill" aria-hidden />
        <div ref={panel} className={cn("dash-assistant-panel", breathing && "is-breathing")} style={breath}>
          <AssistantView ref={composer} onMinimize={() => leaveAssistant()} />
        </div>
      </div>
    </div>
  );
}
