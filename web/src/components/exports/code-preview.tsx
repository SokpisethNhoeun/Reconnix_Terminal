/* JSON-like exports as a scrollable code block. */
import { formatNumber } from "@/lib/format";

export function CodePreview({ text, label }: { text: string; label: string }) {
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-muted">
        {label} · {formatNumber(lines)} lines
      </p>
      <pre className="evidence max-h-[70vh] overflow-auto" tabIndex={0}>
        {text}
      </pre>
    </div>
  );
}
