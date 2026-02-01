import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { z } from "zod";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters } from "@/features/calendar/utils/filters";

const CalendarDailyPage = lazy(() => import("@/pages/CalendarDailyPage"));

import type { CalendarFilters } from "@/features/calendar/types";

const routeApi = getRouteApi("/_authed/calendar/daily");

const calendarSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  search: z.string().optional(),
  maxDays: z.number().optional(),
  calendarId: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : [val];
    }),
  category: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return Array.isArray(val) ? val : [val];
    }),
});

export const Route = createFileRoute("/_authed/calendar/daily")({
  staticData: {
    nav: { iconKey: "Calendar", label: "Detalle Diario", order: 2, section: "Calendario" },
    permission: { action: "read", subject: "CalendarDaily" },
    title: "Detalle diario",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarDaily")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: calendarSearchSchema,
  loaderDeps: ({ search }) => search,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarDailyPage />
    </Suspense>
  ),
  loader: async ({ context, deps: search }) => {
    const defaults = computeDefaultFilters({});
    const filters: CalendarFilters = {
      calendarIds: search.calendarId ?? [],
      categories: search.category ?? [],
      from: search.from ?? (search.date ? search.date : defaults.from),
      maxDays: search.maxDays ?? defaults.maxDays,
      search: search.search ?? "",
      to: search.to ?? (search.date ? search.date : defaults.to),
    };

    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(filters)),
      context.queryClient.ensureQueryData(calendarQueries.daily(filters)),
    ]);
  },
});
