import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { lazy, Suspense } from "react";
import { z } from "zod";

import { PageLoader } from "@/components/ui/PageLoader";

const TreatmentAnalyticsPage = lazy(() =>
  import("@/features/operations/supplies/pages/TreatmentAnalyticsPage").then((m) => ({
    default: m.TreatmentAnalyticsPage,
  })),
);

const MONTH_FORMAT_REGEX = /^\d{4}-\d{2}$/;

const analyticsSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  period: z.enum(["day", "week", "month"]).default("week").optional(),
  month: z
    .string()
    .optional()
    .refine((val) => !val || MONTH_FORMAT_REGEX.test(val), { message: "Invalid month format" }),
  calendarId: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) {
        return undefined;
      }
      return Array.isArray(val) ? val : [val];
    }),
});

export const Route = createFileRoute("/_authed/operations/supplies-analytics")({
  staticData: {
    nav: {
      iconKey: "ChartLine",
      label: "Analytics Tratamientos",
      order: 1,
      section: "Insumos",
    },
    permission: { action: "read", subject: "CalendarEvent" },
    title: "Analytics",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarEvent")) {
      const routeApi = getRouteApi("/_authed/operations/supplies-analytics");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: analyticsSearchSchema,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TreatmentAnalyticsPage />
    </Suspense>
  ),
});
