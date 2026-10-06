/* The approved (or draft) scope manifest of one assessment. */
import type { Assessment } from "@/lib/data/schema";

import { KeyValues } from "../neu/key-values";

export function ScopeDetails({ assessment }: { assessment: Assessment }) {
  const scope = assessment.scope;
  if (!scope) return <p className="text-[13px] text-muted">No scope yet: the template was not chosen.</p>;
  const list = (values: (string | number)[]) => (values.length ? values.join(" · ") : "—");
  return (
    <KeyValues
      items={[
        { label: "Target", value: scope.target_url || assessment.target, mono: true },
        { label: "Allowed actions", value: list(scope.allowed_actions) },
        { label: "Methods", value: list(scope.allowed_methods), mono: true },
        ...(scope.allowed_ports.length ? [{ label: "Ports", value: list(scope.allowed_ports), mono: true }] : []),
        { label: "Excluded", value: list(scope.excluded_paths), mono: true },
        { label: "Time limit", value: `${scope.time_limit_minutes} min` },
        { label: "Tools", value: list(scope.tools) },
      ]}
    />
  );
}
