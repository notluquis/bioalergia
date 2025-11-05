import React from "react";

type SpacingToken = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
type AlignItems = "start" | "center" | "end" | "stretch";

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Spacing between items (from design tokens)
   */
  spacing?: SpacingToken;
  /**
   * Align items on cross axis
   */
  align?: AlignItems;
  /**
   * Use as prop for polymorphism
   */
  as?: React.ElementType;
}

const spacingClasses: Record<SpacingToken, string> = {
  xs: "space-y-1",
  sm: "space-y-2",
  md: "space-y-4",
  lg: "space-y-6",
  xl: "space-y-8",
  "2xl": "space-y-12",
  "3xl": "space-y-16",
};

const alignClasses: Record<AlignItems, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

/**
 * Stack - Vertical flex container with consistent spacing
 */
export default function Stack({
  children,
  spacing = "md",
  align = "stretch",
  as = "div",
  className = "",
  ...props
}: StackProps) {
  const Component = as;
  const classes = `flex flex-col ${spacingClasses[spacing]} ${alignClasses[align]} ${className}`.trim();

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
