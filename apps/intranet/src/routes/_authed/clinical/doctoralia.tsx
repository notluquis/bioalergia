import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { z } from "zod";

import { DoctoraliaAnalyticsPage } from "@/pages/clinical/DoctoraliaAnalyticsPage";

const doctoraliaSearchSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().catch(0),
    pageSize: z.coerce.number().int().min(10).max(100).optional().catch(25),
    tab: z.enum(["mensual", "comparativa", "pacientes", "eventos", "sincronizacion"]).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    compareMetric: z.enum(["total", "programmed", "cancelled", "attended"]).optional(),
  })
  .transform((search) => ({
    page: search.page ?? 0,
    pageSize: search.pageSize ?? 25,
    tab: search.tab ?? "mensual",
    year: search.year,
    compareMetric: search.compareMetric ?? "total",
  }));

export const Route = createFileRoute("/_authed/clinical/doctoralia")({
  component: DoctoraliaAnalyticsPage,
  staticData: {
    nav: {
      iconKey: "Stethoscope",
      label: "Doctoralia (analytics)",
      order: 20,
      section: "Clínica",
    },
    permission: { action: "read", subject: "DoctoraliaCalendarAppointment" },
    title: "Doctoralia — Analytics",
  },
  beforeLoad: requirePermission("read", "DoctoraliaCalendarAppointment"),
  validateSearch: (search: Record<string, unknown>) => doctoraliaSearchSchema.parse(search),
});
