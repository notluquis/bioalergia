import { Chip } from "@heroui/react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: BadgeSize;
  variant?: BadgeVariant;
}
type BadgeSize = "default" | "lg" | "sm" | "xs";

type BadgeVariant = "default" | "destructive" | "ghost" | "outline" | "secondary" | "success" | "warning";

type ChipColor = "accent" | "danger" | "default" | "success" | "warning";
// Map legacy variants to HeroUI v3 Chip props (based on actual installed types)
// HeroUI v3 beta: variant = "primary" | "secondary" | "tertiary" | "soft"
// HeroUI v3 beta: color = "success" | "danger" | "default" | "accent" | "warning"
type ChipVariant = "primary" | "secondary" | "soft" | "tertiary";

const variantMap: Record<BadgeVariant, { color: ChipColor; variant: ChipVariant }> = {
  default: { color: "accent", variant: "primary" },
  destructive: { color: "danger", variant: "primary" },
  ghost: { color: "default", variant: "soft" },
  outline: { color: "default", variant: "tertiary" },
  secondary: { color: "default", variant: "secondary" },
  success: { color: "success", variant: "primary" },
  warning: { color: "warning", variant: "primary" },
};

const sizeMap: Record<BadgeSize, "lg" | "md" | "sm"> = {
  default: "md",
  lg: "lg",
  sm: "sm",
  xs: "sm",
};

function Badge({ children, className, size = "default", variant = "default" }: Readonly<BadgeProps>) {
  // eslint-disable-next-line security/detect-object-injection
  const chipProps = variantMap[variant];
  // eslint-disable-next-line security/detect-object-injection
  const chipSize = sizeMap[size];

  return (
    <Chip className={cn(className)} color={chipProps.color} size={chipSize} variant={chipProps.variant}>
      {children}
    </Chip>
  );
}

// Keep badgeVariants export for compatibility (even though it's not used with HeroUI)
const badgeVariants = () => "";

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
