import { Skeleton } from "@heroui/react";

// Shared loading skeletons for wa-cloud pages. Each variant mirrors the
// shape of its eventual content so the layout doesn't jump when the
// real data lands.

/** Row list with avatar + 2 lines of text. Used in inboxes, scheduled, alerts. */
export function WaListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-default-200 divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-2.5 w-12 rounded" />
            </div>
            <Skeleton className="h-2.5 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid of cards. Used in templates / catalog / broadcasts. */
export function WaCardGridSkeleton({
  cards = 6,
  columns = 3,
}: {
  cards?: number;
  columns?: number;
}) {
  // Tailwind safelist note: keep numeric mappings explicit so JIT picks them up.
  const cols =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : columns === 4
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-3 p-3 ${cols}`}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-default-200 p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Wide table-ish rows. Used in webhook logs / analytics tables. */
export function WaTableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-3 rounded ${c === 0 ? "w-24" : c === cols - 1 ? "w-12" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Generic settings / detail page — title + 2 cards. */
export function WaSettingsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Skeleton className="h-6 w-48 rounded" />
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-default-200 p-5">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
