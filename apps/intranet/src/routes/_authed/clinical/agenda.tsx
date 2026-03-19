import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters, getScheduleDefaultRange } from "@/features/calendar/utils/filters";
import { CalendarSchedulePage } from "@/pages/CalendarSchedulePage";

import {
  type CalendarFilters,
  type CalendarSearchParams,
  calendarSearchSchema,
} from "@/features/calendar/types";

const routeApi = getRouteApi("/_authed/clinical/agenda");

export const Route = createFileRoute("/_authed/clinical/agenda")({
  staticData: {
    nav: { iconKey: "CalendarDays", label: "Agenda", order: 2, section: "Prestaciones" },
    permission: { action: "read", subject: "CalendarSchedule" },
    title: "Agenda clínica",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarSchedule")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = calendarSearchSchema.parse(search);
    if (!parsed.from || !parsed.to) {
      const defaults = getScheduleDefaultRange();
      return {
        ...parsed,
        from: parsed.from ?? defaults.from,
        to: parsed.to ?? defaults.to,
      };
    }
    return parsed;
  },
  component: CalendarSchedulePage,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search }) => {
    if (search.source === "doctoralia") {
      return;
    }

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
