import type { ElementType, ReactNode } from "react";

/**
 * Editorial container — 1200px max, 40px side padding (handoff), responsive
 * down to 20px on mobile. The single horizontal rhythm for every band.
 */
export function Container({
  as: As = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <As className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10 ${className}`}>
      {children}
    </As>
  );
}
