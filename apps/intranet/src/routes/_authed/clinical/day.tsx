import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters } from "@/features/calendar/utils/filters";
import { CalendarDailyPage } from "@/pages/CalendarDailyPage";

import {
  type CalendarFilters,
  type CalendarSearchParams,
  calendarSearchSchema,
} from "@/features/calendar/types";

export const Route = createFileRoute("/_authed/clinical/day")({
  staticData: {
    nav: { iconKey: "CalendarCheck", label: "Calendario — día", order: 17, section: "Clínica" },
    permission: { action: "read", subject: "CalendarDaily" },
    title: "Detalle diario clínico",
  },
  beforeLoad: requirePermission("read", "CalendarDaily"),
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  component: CalendarDailyPage,
  loader: async ({ context, deps: search }) => {
    const defaults = computeDefaultFilters({});
    const filters: CalendarFilters = {
      beneficiaryRut: search.beneficiaryRut,
      calendarIds: search.calendarId ?? [],
      categories: search.category ?? [],
      clinicalSeriesId: search.clinicalSeriesId,
      from: search.from ?? (search.date ? search.date : defaults.from),
      maxDays: search.maxDays ?? defaults.maxDays,
      patientName: search.patientName,
      patientRut: search.patientRut,
      search: search.search ?? "",
      seriesKind: search.seriesKind,
      seriesStatus: search.seriesStatus,
      to: search.to ?? (search.date ? search.date : defaults.to),
    };

    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(filters)),
      context.queryClient.ensureQueryData(calendarQueries.daily(filters)),
    ]);
  },
});
