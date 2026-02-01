import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { lazy, Suspense } from "react";
import { z } from "zod";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";

const CalendarClassificationPage = lazy(() => import("@/pages/CalendarClassificationPage"));

import type { MissingFieldFilters } from "@/features/calendar/api";

const routeApi = getRouteApi("/_authed/calendar/classify");

const classifySearchSchema = z.object({
  page: z.number().optional(),
  missingCategory: z.boolean().optional(),
  missingAmount: z.boolean().optional(),
  missingAttended: z.boolean().optional(),
  missingDosage: z.boolean().optional(),
  missingTreatmentStage: z.boolean().optional(),
  filterMode: z.enum(["AND", "OR"]).optional(),
  calendarId: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : [val];
    }),
});

export const Route = createFileRoute("/_authed/calendar/classify")({
  staticData: {
    nav: { iconKey: "ListChecks", label: "Clasificar", order: 4, section: "Calendario" },
    permission: { action: "update", subject: "CalendarEvent" },
    title: "Clasificar eventos",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "CalendarEvent")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = classifySearchSchema.parse(search);
    return {
      ...parsed,
      page: parsed.page ?? 0,
    };
  },
  loaderDeps: ({ search }) => search,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarClassificationPage />
    </Suspense>
  ),
  loader: async ({ context, deps: search }) => {
    const filters: MissingFieldFilters = {
      missingCategory: search.missingCategory,
      missingAmount: search.missingAmount,
      missingAttended: search.missingAttended,
      missingDosage: search.missingDosage,
      missingTreatmentStage: search.missingTreatmentStage,
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
