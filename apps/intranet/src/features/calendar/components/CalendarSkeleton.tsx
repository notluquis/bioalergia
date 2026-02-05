import { Skeleton } from "@heroui/react";

interface CalendarSkeletonProps {
  days?: number;
}

export function CalendarSkeleton({ days = 3 }: Readonly<CalendarSkeletonProps>) {
  return (
    <div className="space-y-6">
      {Array.from({ length: days }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
        <div className="space-y-3" key={i}>
          {/* Day Header Skeleton */}
          <Skeleton className="h-4 w-32 rounded-lg" />

          {/* Card Skeleton */}
          <div className="rounded-2xl border border-default-200 bg-content1 p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <Skeleton className="h-6 w-64 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-lg" />
                <Skeleton className="h-5 w-24 rounded-lg" />
              </div>
            </div>
            {/* Event rows */}
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
