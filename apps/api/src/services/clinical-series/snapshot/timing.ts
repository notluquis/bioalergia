import dayjs from "dayjs";

import type { ClinicalSeriesSnapshot } from "../types.ts";

export function isPastOrTodayEvent(eventDate: string, today: string): boolean {
  return eventDate <= today;
}

export function resolveAbandonmentBucket(
  daysSinceLastEvent: null | number
): null | "month_1" | "month_2" | "month_3" | "month_4_plus" {
  if (daysSinceLastEvent == null || daysSinceLastEvent < 30) return null;
  if (daysSinceLastEvent < 60) return "month_1" as const;
  if (daysSinceLastEvent < 90) return "month_2" as const;
  if (daysSinceLastEvent < 120) return "month_3" as const;
  return "month_4_plus" as const;
}

export function computeSnapshotTiming(
  snapshot: Pick<ClinicalSeriesSnapshot, "events">,
  today: string
): {
  abandonmentBucket: ReturnType<typeof resolveAbandonmentBucket>;
  daysSinceLastEvent: null | number;
  lastEventDate: null | string;
  nextEventDate: null | string;
  upcomingCount: number;
} {
  const past = snapshot.events.filter((event) => event.eventDate <= today);
  const future = snapshot.events.filter((event) => event.eventDate > today);

  const lastEventDate = past.length
    ? past.reduce(
        (acc, event) => (event.eventDate > acc ? event.eventDate : acc),
        past[0]!.eventDate
      )
    : null;
  const nextEventDate = future.length
    ? future.reduce(
        (acc, event) => (event.eventDate < acc ? event.eventDate : acc),
        future[0]!.eventDate
      )
    : null;
  const upcomingCount = future.length;
  const daysSinceLastEvent = lastEventDate
    ? dayjs(today, "YYYY-MM-DD").diff(dayjs(lastEventDate, "YYYY-MM-DD"), "day")
    : null;

  return {
    abandonmentBucket: resolveAbandonmentBucket(daysSinceLastEvent),
    daysSinceLastEvent,
    lastEventDate,
    nextEventDate,
    upcomingCount,
  };
}
