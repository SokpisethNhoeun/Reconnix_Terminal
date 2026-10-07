/* The landing site's wordmark, `<reconix />`, with an optional line under it. */
import { cn } from "@/lib/utils";

export function Wordmark({ sub, className }: { sub?: string; className?: string }) {
  return (
    <span className={cn("block font-mono", className)}>
      <span className="tracking-tight">
        <span className="text-muted">&lt;</span>
        <b className="font-semibold text-text">reconix</b>
        <span className="text-muted"> /&gt;</span>
      </span>
      {sub && <small className="block text-[11px] text-muted">{sub}</small>}
    </span>
  );
}
