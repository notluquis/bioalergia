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
  return <div className={cn("animate-pulse rounded-md bg-default-50/50", className)} {...props} />;
}
