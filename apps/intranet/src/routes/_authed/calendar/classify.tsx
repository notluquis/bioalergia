import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { z } from "zod";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";

const CalendarClassificationPage = lazy(() => import("@/pages/CalendarClassificationPage"));

const routeApi = getRouteApi("/_authed/calendar/classify");

const classifySearchSchema = z.object({
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
  validateSearch: classifySearchSchema,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarClassificationPage />
    </Suspense>
  ),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.unclassified(0, 50, {})),
      context.queryClient.ensureQueryData(calendarQueries.options()),
    ]);
  },
});
