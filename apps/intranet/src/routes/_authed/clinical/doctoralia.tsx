import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";

import { DoctoraliaAnalyticsPage } from "@/pages/clinical/DoctoraliaAnalyticsPage";

const doctoraliaSearchSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().catch(0),
    pageSize: z.coerce.number().int().min(10).max(100).optional().catch(25),
    tab: z.enum(["mensual", "comparativa", "pacientes", "eventos", "sincronizacion"]).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    compareMetric: z.enum(["total", "bookings", "modifications", "cancellations"]).optional(),
  })
  .transform((search) => ({
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 25,
    tab: search.tab ?? "mensual",
    year: search.year,
    compareMetric: search.compareMetric ?? "total",
  }));

const routeApi = getRouteApi("/_authed/clinical/doctoralia");

export const Route = createFileRoute("/_authed/clinical/doctoralia")({
  component: DoctoraliaAnalyticsPage,
  staticData: {
    nav: {
      iconKey: "ClipboardList",
      label: "Doctoralia",
      order: 2,
      section: "Prestaciones",
    },
    permission: { action: "read", subject: "DoctoraliaCalendarAppointment" },
    title: "Doctoralia",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "DoctoraliaCalendarAppointment")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => doctoraliaSearchSchema.parse(search),
});
