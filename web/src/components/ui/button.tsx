/* shadcn/ui Button, themed to the dashboard's soft-UI tokens (raised object; pressed when
   active). Owned source — extend the variants here. `buttonVariants` styles links as buttons. */
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[13px] font-medium " +
    "cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-bg text-text shadow-[var(--raise-sm)] hover:text-accent active:shadow-[var(--press-sm)] [&_svg]:text-accent",
        accent:
          "bg-bg text-accent shadow-[var(--raise-sm)] active:shadow-[var(--press-sm)] [&_svg]:text-accent",
        ghost: "text-muted hover:text-accent [&_svg]:text-accent",
        link: "text-accent underline-offset-4 hover:underline [&_svg]:text-accent",
      },
      size: {
        default: "px-4 py-2 text-[13px] [&_svg]:size-4",
        sm: "px-3 py-1.5 text-[12.5px] [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
