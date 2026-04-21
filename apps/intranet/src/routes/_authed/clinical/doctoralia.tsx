import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import { z } from "zod";

import { DoctoraliaAnalyticsPage } from "@/pages/clinical/DoctoraliaAnalyticsPage";

const doctoraliaSearchSchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    page: z.coerce.number().int().min(0).optional().catch(0),
    pageSize: z.coerce.number().int().min(10).max(100).optional().catch(25),
    tab: z.enum(["calendario", "pacientes", "eventos", "sincronizacion"]).optional(),
  })
  .transform((search) => {
    const today = dayjs();
    const base = today.day() === 0 ? today.add(1, "day") : today;
    const weekStart = base.isoWeekday(1);
    return {
      from: search.from ?? weekStart.format("YYYY-MM-DD"),
      to: search.to ?? weekStart.add(6, "day").format("YYYY-MM-DD"),
      page: search.page ?? 0,
      pageSize: search.pageSize ?? 25,
      tab: search.tab ?? "calendario",
    };
  });

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
