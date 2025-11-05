import React from "react";

type SpacingToken = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
type Columns = 1 | 2 | 3 | 4 | 6 | 12;

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Gap between grid items
   */
  gap?: SpacingToken;
  /**
   * Columns on mobile (<640px)
   */
  cols?: Columns;
  /**
   * Columns on tablet (≥768px)
   */
  colsMd?: Columns;
  /**
   * Columns on desktop (≥1024px)
   */
  colsLg?: Columns;
  /**
   * Columns on wide desktop (≥1280px)
   */
  colsXl?: Columns;
}

const gapClasses: Record<SpacingToken, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
  "2xl": "gap-12",
  "3xl": "gap-16",
};

const colsClasses: Record<Columns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  6: "grid-cols-6",
  12: "grid-cols-12",
};

/**
 * Grid - Responsive grid layout with breakpoint support
 */
export default function Grid({
  children,
  gap = "lg",
  cols = 1,
  colsMd,
  colsLg,
  colsXl,
  className = "",
  ...props
}: GridProps) {
  const gapClass = gapClasses[gap];
  const baseColsClass = colsClasses[cols];
  const mdColsClass = colsMd ? `md:${colsClasses[colsMd]}` : "";
  const lgColsClass = colsLg ? `lg:${colsClasses[colsLg]}` : "";
  const xlColsClass = colsXl ? `xl:${colsClasses[colsXl]}` : "";

  const classes = `grid ${gapClass} ${baseColsClass} ${mdColsClass} ${lgColsClass} ${xlColsClass} ${className}`.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
