import { Skeleton } from "@heroui/react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { lazy, Suspense } from "react";
import { z } from "zod";

import { calendarQueries } from "@/features/calendar/queries";

const CalendarClassificationPage = lazy(() =>
  import("@/pages/CalendarClassificationPage").then((m) => ({
    default: m.CalendarClassificationPage,
  })),
);

import type { MissingFieldFilters } from "@/features/calendar/api";

const routeApi = getRouteApi("/_authed/calendar/classify");

const MISSING_FILTER_KEYS = [
  "missingCategory",
  "missingAmountExpected",
  "missingAmountPaid",
  "missingAttended",
  "missingDosage",
  "missingTreatmentStage",
] as const;

function isMissingFilterKey(value: string): boolean {
  return (MISSING_FILTER_KEYS as readonly string[]).includes(value);
}

const arrayPreprocess = (val: unknown) => {
  if (!val) {
    return undefined;
  }
  if (Array.isArray(val)) {
    return val;
  }
  return [val];
};

const classifySearchSchema = z
  .object({
    page: z.coerce.number().optional().catch(0),
    missing: z
      .preprocess(arrayPreprocess, z.array(z.string()).optional())
      .refine((values) => !values || values.every(isMissingFilterKey), {
        message: "Invalid missing filter key",
      }),
    filterMode: z.enum(["AND", "OR"]).optional(),
    calendarId: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) {
          return undefined;
        }
        return Array.isArray(val) ? val : [val];
      }),
  })
  .transform((search) => ({
    page: search.page ?? 0,
    missing: search.missing?.length ? [...new Set(search.missing)] : undefined,
    filterMode: search.filterMode,
    calendarId: search.calendarId,
  }));

type ClassifySearchParams = z.infer<typeof classifySearchSchema>;

export const Route = createFileRoute("/_authed/calendar/classify")({
  staticData: {
    nav: { iconKey: "ListChecks", label: "Clasificar", order: 4, section: "Calendario" },
    permission: { action: "update", subject: "CalendarEvent" },
    title: "Clasificar eventos",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "CalendarEvent")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>): ClassifySearchParams =>
    classifySearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  component: () => (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-52 rounded-lg" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      }
    >
      <CalendarClassificationPage />
    </Suspense>
  ),

  loader: async ({ context, deps: search }) => {
    const filters: MissingFieldFilters = {
      missing: search.missing,
      filterMode: search.filterMode,
    };

    await Promise.all([
      context.queryClient.ensureQueryData(
        calendarQueries.unclassified(search.page ?? 0, 50, filters),
      ),
      context.queryClient.ensureQueryData(calendarQueries.options()),
    ]);
  },
});
