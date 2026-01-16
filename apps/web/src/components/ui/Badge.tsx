import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("badge no-animation transition-all duration-200 ease-apple font-medium", {
  variants: {
    variant: {
      default: "badge-primary text-primary-content border-transparent",
      secondary: "badge-secondary text-secondary-content border-transparent",
      destructive: "badge-error text-error-content border-transparent", // DaisyUI uses 'error' not 'destructive'
      outline: "badge-outline text-base-content",
      success: "badge-success text-success-content border-transparent",
      warning: "badge-warning text-warning-content border-transparent",
      ghost: "badge-ghost text-base-content/80",
    },
    size: {
      default: "badge-md",
      sm: "badge-sm",
      lg: "badge-lg",
      xs: "badge-xs",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
