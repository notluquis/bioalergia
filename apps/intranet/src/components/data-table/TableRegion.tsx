import type React from "react";

import { cn } from "@/lib/utils";

interface TableRegionProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly tableHeight?: number | string;
}

const toCssSize = (value: number | string | undefined) =>
  typeof value === "number" ? `${value}px` : value;

/**
 * Shared table surface with consistent clipping and a single explicit table height contract.
 */
export function TableRegion({
  children,
  className,
  contentClassName,
  tableHeight = "min(68dvh, 760px)",
}: Readonly<TableRegionProps>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-default-200/70 bg-background/70",
        className,
      )}
    >
      <div
        className={cn("min-h-0", contentClassName)}
        style={{
          // Exposed as CSS variable so nested components can reuse exact sizing without hardcoding.
          ["--table-region-height" as string]: toCssSize(tableHeight),
        }}
      >
        {children}
      </div>
    </div>
  );
}
