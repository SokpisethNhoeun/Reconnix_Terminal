/* The amber banner shown while an assessment waits for the operator: it says what it waits
   on and points to the AI Assistant, where the decision is made. */
import { ArrowRight, Hourglass } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { Assessment } from "@/lib/data/schema";
import { TERMINAL_PAGE } from "@/lib/terminal/paths";
import { cn } from "@/lib/utils";

export function WaitingBanner({
  assessment: a,
  operator,
  context,
}: {
  assessment: Assessment;
  operator: boolean;
  context: "list" | "detail";
}) {
  const href = operator ? TERMINAL_PAGE : `/assessments/${a.uid}`;
  const cta = operator ? (context === "list" ? "Continue in AI Assistant" : "Review plan in AI Assistant") : "View assessment";
  return (
    <div className="banner-warn">
      <Hourglass size={18} aria-hidden />
      <p className="min-w-0">
        {context === "list" ? (
          <>
            <b className="font-semibold">{a.label} is waiting for you.</b> Only one assessment runs at a time. Answer it in the AI
            Assistant.
          </>
        ) : (
          <>
            <b className="font-semibold">Needs your decision:</b> the AI is waiting for you to{" "}
            {a.waiting_for || "approve the scan plan"} before it continues.
          </>
        )}
      </p>
      <Link href={href} className={cn(buttonVariants({ variant: "accent", size: "sm" }), "ml-auto flex-none")}>
        {cta}
        <ArrowRight size={15} aria-hidden />
      </Link>
    </div>
  );
}
