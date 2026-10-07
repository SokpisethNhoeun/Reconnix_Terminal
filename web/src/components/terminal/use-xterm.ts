"use client";

/* An xterm.js terminal inside `host`, kept the size of it (fit addon) and colored from
   tokens.css. xterm.js needs the browser, so it is loaded once the host is mounted, after
   the fonts (its cell size is measured from them). While the host is hidden it keeps its
   size instead of shrinking the TUI to nothing. */
import type { Terminal } from "@xterm/xterm";
import { type RefObject, useEffect, useState } from "react";

export function useXterm(host: RefObject<HTMLDivElement | null>): Terminal | null {
  const [terminal, setTerminal] = useState<Terminal | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let cleanup = () => {};

    void (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit"), document.fonts.ready]);
      if (cancelled) return;
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(name).trim();
      const term = new Terminal({
        fontFamily: `${token("--font-code") || "monospace"}, ui-monospace, monospace`,
        fontSize: 13,
        cursorBlink: true,
        theme: { background: token("--term-bg"), foreground: token("--term-text"), cursor: token("--term-cursor"), cursorAccent: token("--term-bg") },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(element);

      let frame = 0;
      const refit = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (element.clientWidth > 0 && element.clientHeight > 0) fit.fit();
        });
      };
      refit();
      const observer = new ResizeObserver(refit);
      observer.observe(element);
      setTerminal(term);
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        term.dispose();
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [host]);

  return terminal;
}
