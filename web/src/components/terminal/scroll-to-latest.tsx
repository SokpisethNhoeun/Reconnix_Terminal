"use client";

/* "↓ Latest": shown over the terminal only while its view is scrolled up. */
import { ArrowDown } from "lucide-react";

export function ScrollToLatest({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  if (!shown) return null;
  return (
    <button type="button" className="term-latest" onClick={onClick} aria-label="Scroll to the latest output">
      <ArrowDown size={14} aria-hidden />
      Latest
    </button>
  );
}
