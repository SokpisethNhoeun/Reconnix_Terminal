"use client";

/* Keeps the terminal session alive while you browse: the dashboard layout renders this, it
   mounts the panel on the first visit to /terminal, and on the other pages only hides it.
   (A page's own state would be lost on navigation, and with it the TUI.) */
import { usePathname } from "next/navigation";
import { useState } from "react";

import { TERMINAL_PAGE } from "@/lib/terminal/paths";

import { TerminalPanel } from "./terminal-panel";

export function TerminalDock() {
  const shown = usePathname() === TERMINAL_PAGE;
  const [opened, setOpened] = useState(shown);
  if (shown && !opened) setOpened(true); // first visit: start the session
  return opened ? <TerminalPanel hidden={!shown} /> : null;
}
