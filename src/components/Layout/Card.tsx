import React from "react";

type CardPadding = "compact" | "default" | "spacious" | "none";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Padding variant
   * - compact: p-4 (16px)
   * - default: p-6 (24px)
   * - spacious: p-8 (32px)
   * - none: p-0 (for custom padding)
   */
  padding?: CardPadding;
  /**
   * Show border (default: true)
   */
  bordered?: boolean;
  /**
   * Shadow depth
   */
  shadow?: "none" | "sm" | "md" | "lg";
}

const paddingClasses: Record<CardPadding, string> = {
  compact: "p-4",
  default: "p-6",
  spacious: "p-8",
  none: "",
};

const shadowClasses: Record<NonNullable<CardProps["shadow"]>, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow",
  lg: "shadow-lg",
};

/**
 * Card - Standardized container component
 * Uses DaisyUI card classes with consistent padding tokens
 */
export default function Card({
  children,
  padding = "default",
  bordered = false,
  shadow = "none",
  className = "",
  ...props
}: CardProps) {
  const baseClasses = "surface-recessed";
  const borderClasses = bordered ? "border border-base-300" : "border border-transparent";
  const paddingClass = paddingClasses[padding];
  const shadowClass = shadowClasses[shadow];

  return (
    <div className={`${baseClasses} ${borderClasses} ${paddingClass} ${shadowClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
