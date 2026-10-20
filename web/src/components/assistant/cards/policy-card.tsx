/* Policy restrictions from the saved data: how many requests were checked against the approved
   scope, and the ones it blocked (never sent), each with the request and the policy's reason,
   masked (lib/assistant/cards.ts joins them as "METHOD path · reason"). */
import { ShieldX } from "lucide-react";
import { POLICY_DECISION } from "@/lib/status";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CardOf } from "@/lib/assistant/protocol";
import { CardShell, runName } from "./card-shell";

/** "GET /admin · Path outside approved scope" → the request and the reason. */
export function splitVerdict(text: string): { request: string; reason: string | null } {
  const at = text.lastIndexOf(" · ");
  return at < 0 ? { request: text, reason: null } : { request: text.slice(0, at), reason: text.slice(at + 3) };
}

export function PolicyCard({ card }: { card: CardOf<"policy"> }) {
  return (
    <CardShell icon={ShieldX} title="Policy checks" meta={`${card.checks} checked · ${card.blocked} blocked`}>
      {card.items.length === 0 ? (
        <div className="ai-card-row is-center">
          <StatusBadge meaning={POLICY_DECISION.allowed} label="Nothing blocked" />
          <span className="text-[12px] text-muted-foreground">Every checked request was inside the approved scope.</span>
        </div>
      ) : (
        <ul aria-label="Blocked requests">
          {card.items.map((b, i) => {
            const { request, reason } = splitVerdict(b.text);
            return (
              <li key={`${b.run.uid}-${i}`} className="ai-card-row">
                <StatusBadge meaning={POLICY_DECISION.blocked} label="Blocked" />
                <div className="ai-card-row-main">
                  <p className="ai-card-line">
                    <span className="ai-mono text-[12.5px]">{request}</span>
                  </p>
                  {reason && <p className="ai-card-sub text-foreground">Reason: {reason}</p>}
                  <p className="ai-card-sub">
                    <span className="ai-num">{b.time}</span> · {runName(b.run)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {card.more > 0 && <p className="ai-card-empty">{card.more} more blocked requests.</p>}
    </CardShell>
  );
}
