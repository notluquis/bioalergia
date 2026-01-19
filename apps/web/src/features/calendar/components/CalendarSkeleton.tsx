interface CalendarSkeletonProps {
  days?: number;
}

export function CalendarSkeleton({ days = 3 }: Readonly<CalendarSkeletonProps>) {
  return (
    <div className="space-y-5">
      {Array.from({ length: days }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
        <div className="animate-pulse space-y-2" key={i}>
          {/* Day Header Skeleton */}
          <div className="bg-base-300 h-4 w-24 rounded"></div>

          {/* Card Skeleton */}
          <div className="border-base-300 bg-base-100 rounded-2xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="bg-base-300 h-5 w-48 rounded"></div>
              <div className="flex gap-2">
                <div className="bg-base-200 h-4 w-20 rounded"></div>
                <div className="bg-base-200 h-4 w-20 rounded"></div>
              </div>
            </div>
            {/* Event rows */}
            <div className="mt-4 space-y-3">
              <div className="bg-base-200/50 h-24 rounded-xl"></div>
              <div className="bg-base-200/50 h-24 rounded-xl"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
