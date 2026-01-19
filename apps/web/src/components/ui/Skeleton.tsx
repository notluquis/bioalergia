/**
 * Skeleton Component - Native HTML with animation
 *
 * Simple loading placeholder with shimmer animation.
 */
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export default function Skeleton({
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn("bg-base-200/50 animate-pulse rounded-md", className)} {...props} />;
}
