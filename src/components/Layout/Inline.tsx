import React from "react";

type SpacingToken = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
type AlignItems = "start" | "center" | "end" | "stretch";
type JustifyContent = "start" | "center" | "end" | "between" | "around";

interface InlineProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Spacing between items (from design tokens)
   */
  spacing?: SpacingToken;
  /**
   * Align items on cross axis
   */
  align?: AlignItems;
  /**
   * Justify content on main axis
   */
  justify?: JustifyContent;
  /**
   * Allow wrapping
   */
  wrap?: boolean;
  /**
   * Use as prop for polymorphism
   */
  as?: React.ElementType;
}

const spacingClasses: Record<SpacingToken, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
  "2xl": "gap-12",
  "3xl": "gap-16",
};

const alignClasses: Record<AlignItems, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const justifyClasses: Record<JustifyContent, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

/**
 * Inline - Horizontal flex container with consistent spacing
 */
export default function Inline({
  children,
  spacing = "md",
  align = "stretch",
  justify = "start",
  wrap = false,
  as = "div",
  className = "",
  ...props
}: InlineProps) {
  const Component = as;
  const wrapClass = wrap ? "flex-wrap" : "";
  const classes =
    `flex ${spacingClasses[spacing]} ${alignClasses[align]} ${justifyClasses[justify]} ${wrapClass} ${className}`.trim();

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
