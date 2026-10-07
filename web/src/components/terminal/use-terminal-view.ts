"use client";

/* What the terminal's controls do to the view, apart from the session: copy its text,
   clear it, and jump back to the latest output. `atBottom` is false while the view is
   scrolled up in its scrollback (the TUI is full-screen, so that is mostly after it has
   exited and left text behind). Nothing here sends anything to the session. */
import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useState } from "react";

import { type ScreenLine, screenText } from "@/lib/terminal/screen-text";

export function useTerminalView(terminal: Terminal | null) {
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    if (!terminal) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const buffer = terminal.buffer.active;
        setAtBottom(buffer.viewportY >= buffer.baseY);
      });
    };
    const subscriptions = [terminal.onScroll(check), terminal.onWriteParsed(check), terminal.buffer.onBufferChange(check)];
    check();
    return () => {
      cancelAnimationFrame(frame);
      subscriptions.forEach((s) => s.dispose());
    };
  }, [terminal]);

  /** The selection if there is one, else everything in the terminal, to the clipboard. */
  const copy = useCallback(async (): Promise<boolean> => {
    if (!terminal) return false;
    const text = terminal.hasSelection() ? terminal.getSelection() : bufferText(terminal);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, [terminal]);

  /** Wipes the screen and the scrollback (the session goes on; see the panel's redraw). */
  const clear = useCallback(() => {
    terminal?.clear();
  }, [terminal]);

  const scrollToLatest = useCallback(() => {
    terminal?.scrollToBottom();
    terminal?.focus();
  }, [terminal]);

  return { atBottom, copy, clear, scrollToLatest };
}

function bufferText(terminal: Terminal): string {
  const buffer = terminal.buffer.active;
  const lines: ScreenLine[] = [];
  for (let y = 0; y < buffer.length; y++) {
    const line = buffer.getLine(y);
    if (!line) continue;
    const next = buffer.getLine(y + 1);
    // keep the spaces at the end of a line that wraps on, so words don't run together
    lines.push({ text: line.translateToString(!next?.isWrapped), wrapped: line.isWrapped });
  }
  return screenText(lines);
}
