"use client";

/* Switches between the light and dark soft-UI palettes. */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="btn rounded-full px-3.5 py-1.5 text-[12.5px] text-muted"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to the light theme" : "Switch to the dark theme"}
    >
      {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
