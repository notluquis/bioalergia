import { Chip } from "@heroui/react";
import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "ghost";
type BadgeSize = "default" | "sm" | "lg" | "xs";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

// Map legacy variants to HeroUI v3 Chip props (based on actual installed types)
// HeroUI v3 beta: variant = "primary" | "secondary" | "tertiary" | "soft"
// HeroUI v3 beta: color = "success" | "danger" | "default" | "accent" | "warning"
type ChipVariant = "primary" | "secondary" | "tertiary" | "soft";
type ChipColor = "success" | "danger" | "default" | "accent" | "warning";

const variantMap: Record<BadgeVariant, { variant: ChipVariant; color: ChipColor }> = {
  default: { variant: "primary", color: "accent" },
  secondary: { variant: "secondary", color: "default" },
  destructive: { variant: "primary", color: "danger" },
  outline: { variant: "tertiary", color: "default" },
  success: { variant: "primary", color: "success" },
  warning: { variant: "primary", color: "warning" },
  ghost: { variant: "soft", color: "default" },
};

const sizeMap: Record<BadgeSize, "sm" | "md" | "lg"> = {
  xs: "sm",
  sm: "sm",
  default: "md",
  lg: "lg",
};

function Badge({ className, variant = "default", size = "default", children }: BadgeProps) {
  const chipProps = variantMap[variant];
  const chipSize = sizeMap[size];

  return (
    <Chip variant={chipProps.variant} color={chipProps.color} size={chipSize} className={cn(className)}>
      {children}
    </Chip>
  );
}

// Keep badgeVariants export for compatibility (even though it's not used with HeroUI)
const badgeVariants = () => "";

export { Badge, badgeVariants };
