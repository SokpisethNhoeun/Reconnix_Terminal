/* What the Terminal view shows while this dashboard doesn't host the terminal: why, and how to
   turn it on. Server component; it never renders the terminal itself. */
import Link from "next/link";
import { TerminalSquare } from "lucide-react";

const CODE = "rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground";

export function TerminalNotice() {
  return (
    <section className="dash-card flex max-w-2xl flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-foreground">
        <TerminalSquare className="size-4 text-primary" aria-hidden />
        The terminal is off
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This dashboard was started with <code className={CODE}>--no-terminal</code>. Start it from the TUI with{" "}
        <code className={CODE}>/web</code>, or with <code className={CODE}>npm run dev</code> in <code className={CODE}>web/</code>,
        to run the TUI here.
      </p>
      <Link href="/docs/terminal-guide#screens" className="w-fit rounded-sm text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Terminal docs
      </Link>
    </section>
  );
}
