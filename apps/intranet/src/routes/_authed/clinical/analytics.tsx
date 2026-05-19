import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { z } from "zod";
import { TreatmentAnalyticsPage } from "@/features/operations/supplies/pages/TreatmentAnalyticsPage";

const MONTH_FORMAT_REGEX = /^\d{4}-\d{2}$/;

const analyticsSearchSchema = z.object({
  beneficiaryRut: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  clinicalSeriesId: z.coerce.number().int().positive().optional(),
  patientRut: z.string().optional(),
  period: z.enum(["day", "week", "month"]).default("week").optional(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).optional(),
  seriesStatus: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
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

const routeApi = getRouteApi("/_authed/clinical/analytics");

export const Route = createFileRoute("/_authed/clinical/analytics")({
  staticData: {
    nav: {
      iconKey: "TrendingUp",
      label: "Tratamientos — analytics",
      order: 25,
      section: "Clínica",
    },
    permission: { action: "read", subject: "CalendarEvent" },
    title: "Analytics clínico",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarEvent")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: analyticsSearchSchema,
  component: TreatmentAnalyticsPage,
});
