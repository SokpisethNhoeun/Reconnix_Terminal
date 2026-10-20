"use client";

/* The one globe, shared. The dashboard's <Globe /> creates it (a carrier element holding the
   WebGL canvas) in the Overview's hero and publishes it here; the assistant stage carries that
   same element into its own layer while the assistant is open and hands it back when it closes.
   There is never a second globe or a second WebGL context.

   The stage's wishes (paused because it faded out, ambient quality) are kept here too, so they
   apply even when three.js finishes loading after the stage asked. */
import { useSyncExternalStore } from "react";
import type { GlobeControls } from "@/lib/globe";

export interface SharedGlobe {
  carrier: HTMLElement; // what moves between the hero and the assistant stage
  home: HTMLElement; // its place in the hero (.dash-globe-wrap)
  canvas: HTMLCanvasElement;
  controls: GlobeControls | null; // null until three.js has loaded (or without WebGL)
}

let current: SharedGlobe | null = null;
const listeners = new Set<() => void>();
const holds = new Set<string>();
let ambient = false;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Called by <Globe />: when it mounts, when its controls are ready (a new object), and with
    null when it unmounts. */
export function publishGlobe(globe: SharedGlobe | null): void {
  current = globe;
  if (globe?.controls) {
    for (const reason of holds) globe.controls.pause(reason);
    globe.controls.setAmbient(ambient);
  }
  for (const listener of listeners) listener();
}

export const sharedGlobe = (): SharedGlobe | null => current;

/** The shared globe, re-rendering when it mounts, gets its controls or goes away. */
export function useSharedGlobe(): SharedGlobe | null {
  return useSyncExternalStore(subscribe, sharedGlobe, () => null);
}

/** Pause (on) or release (off) the globe's drawing for `reason`. */
export function holdGlobe(reason: string, on: boolean): void {
  if (on) holds.add(reason);
  else holds.delete(reason);
  const controls = current?.controls;
  if (controls) {
    if (on) controls.pause(reason);
    else controls.resume(reason);
  }
}

/** Ambient quality while it sits behind the assistant (no bloom, ~30 fps). */
export function setGlobeAmbient(on: boolean): void {
  ambient = on;
  current?.controls?.setAmbient(on);
}
