import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export default function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-base-200/50 animate-pulse rounded-md", className)} {...props} />;
}
