/* Aligned label/value rows. */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface KeyValue {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export function KeyValues({ items }: { items: KeyValue[] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted">{item.label}</dt>
          <dd className={cn("m-0 mb-2 flex flex-wrap items-center gap-1.5 [overflow-wrap:anywhere] sm:mb-0", item.mono && "font-mono text-[12.5px]")}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
