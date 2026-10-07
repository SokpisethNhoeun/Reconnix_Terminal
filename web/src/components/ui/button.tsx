/* shadcn/ui Button, themed to the dashboard's tokens: an outlined card (default) or solid
   teal (accent, the landing site's primary button); `quiet` is a muted icon button for a
   toolbar on a well. Owned source — extend the variants here.
   `buttonVariants` styles links as buttons. */
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium " +
    "cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-card text-text shadow-[var(--raise-sm)] hover:text-accent active:bg-well [&_svg]:text-accent",
        accent:
          "bg-accent font-semibold text-accent-ink hover:bg-accent/90 active:bg-accent/80 [&_svg]:text-accent-ink",
        ghost: "text-muted hover:text-accent [&_svg]:text-accent",
        quiet: "text-muted hover:bg-card hover:text-accent",
        link: "text-accent underline-offset-4 hover:underline [&_svg]:text-accent",
      },
      size: {
        default: "px-4 py-2 text-[13px] [&_svg]:size-4",
        sm: "px-3 py-1.5 text-[12.5px] [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 rounded-[8px] [&_svg]:size-4",
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
