/* What the Terminal view shows to a browser that may not open the terminal: why, and how to
   get in. Server component; it never renders the terminal itself. */
import Link from "next/link";
import { KeyRound, TerminalSquare } from "lucide-react";

import type { TerminalAccess } from "@/lib/auth/guard";

const CODE = "rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground";

export function TerminalNotice({ access }: { access: Exclude<TerminalAccess, "operator"> }) {
  const Icon = access === "viewer" ? KeyRound : TerminalSquare;
  return (
    <section className="dash-card flex max-w-2xl flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {access === "viewer" ? "The terminal needs the operator role" : "The terminal is off"}
      </h2>
      {access === "viewer" ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          The terminal has full control of the TUI. Sign in again with the dashboard&apos;s current link: run{" "}
          <code className={CODE}>/web</code> in the TUI, or open the link that <code className={CODE}>npm run dev</code> printed.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          This dashboard was started with <code className={CODE}>--no-terminal</code>. Start it from the TUI with{" "}
          <code className={CODE}>/web</code>, or with <code className={CODE}>npm run dev</code> in <code className={CODE}>web/</code>,
          to run the TUI here.
        </p>
      )}
      <Link href="/docs/terminal-guide/screens" className="w-fit rounded-sm text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Terminal docs
      </Link>
    </section>
  );
}
