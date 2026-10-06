/* shadcn/ui Input, themed to the dashboard's soft-UI tokens: a pressed "well" that deepens
   with an accent ring on focus. Owned source. */
import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-[13px] bg-transparent px-3.5 py-2 text-[13px] text-text",
        "shadow-[var(--press-sm)] outline-none transition-shadow placeholder:text-muted",
        "focus-visible:shadow-[var(--press-sm),0_0_0_2px_var(--accent)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
