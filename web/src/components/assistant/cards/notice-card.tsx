/* What the assistant can't do, or what went wrong, and what to do instead: plan or start an
   assessment, run a tool, approve (all in the TUI), a model that isn't set up, too many
   questions. Operators get a way to the Terminal view; a failed answer gets Retry. */
import { Info, OctagonAlert, RotateCcw, TriangleAlert } from "lucide-react";
import type { CardOf } from "@/lib/assistant/protocol";
import { CardShell } from "./card-shell";
import { TerminalButton } from "./links";

const ICON = { info: Info, warning: TriangleAlert, danger: OctagonAlert } as const;

export function NoticeCard({ card, onRetry }: { card: CardOf<"notice">; onRetry?: () => void }) {
  const actions = card.action === "terminal" || onRetry;
  return (
    <CardShell
      icon={ICON[card.tone]}
      tone={card.tone}
      title={card.title}
      footer={
        actions ? (
          <>
            <span />
            <span className="flex gap-2">
              {onRetry && (
                <button type="button" onClick={onRetry} className="ai-btn ai-btn-small ai-btn-outline">
                  <RotateCcw className="size-3.5" aria-hidden /> Retry
                </button>
              )}
              {card.action === "terminal" && <TerminalButton />}
            </span>
          </>
        ) : undefined
      }
    >
      <div className="ai-card-section">
        <p className="ai-card-text">{card.body}</p>
        {card.steps.length > 0 && (
          <ol className="ai-card-text ai-card-steps">
            {card.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
      </div>
    </CardShell>
  );
}
