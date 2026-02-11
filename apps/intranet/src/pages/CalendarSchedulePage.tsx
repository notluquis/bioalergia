import { ButtonGroup, Chip, Label, ListBox, Select, Surface } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/Button";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { ScheduleCalendar } from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import type { CalendarEventDetail } from "@/features/calendar/types";
import { fetchDoctoraliaCalendarAppointments } from "@/features/doctoralia/api";
import { useDisclosure } from "@/hooks/use-disclosure";
import { numberFormatter } from "@/lib/format";

const routeApi = getRouteApi("/_authed/calendar/schedule");
import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

function toCalendarEventDetail(
  appointments: Awaited<ReturnType<typeof fetchDoctoraliaCalendarAppointments>>,
): CalendarEventDetail[] {
  return appointments.map((appointment) => ({
    calendarId: `doctoralia:${appointment.schedule.externalId}`,
    category: null,
    colorId: null,
    controlIncluded: null,
    description: appointment.comments,
    endDate: appointment.endAt.toISOString().split("T")[0] ?? null,
    endDateTime: appointment.endAt.toISOString(),
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: appointment.startAt.toISOString().split("T")[0] ?? appointment.startAt.toISOString(),
    eventDateTime: appointment.startAt.toISOString(),
    eventId: String(appointment.externalId),
    eventType: "doctoralia",
    eventUpdatedAt: null,
    hangoutLink: null,
    location: appointment.schedule.displayName,
    rawEvent: appointment,
    startDate: appointment.startAt.toISOString().split("T")[0] ?? null,
    startDateTime: appointment.startAt.toISOString(),
    startTimeZone: null,
    status: String(appointment.status),
    summary: appointment.title,
    transparency: null,
    visibility: null,
  }));
}

// Logic moved to validateSearch in route, but we still use it for comparison logic
const getActualWeekStart = () => {
  const today = dayjs();
  const base = today.day() === 0 ? today.add(1, "day") : today;
  return base.isoWeekday(1);
};

function CalendarSchedulePage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const source = search.source ?? "google";
  const isGoogleSource = source === "google";

  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  const { appliedFilters, availableCategories, daily, defaults, loading, summary } =
    useCalendarEvents({ enabled: isGoogleSource });

  const doctoraliaScheduleIds =
    search.calendarId?.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0) ?? [];

  const { data: doctoraliaEvents = [], isLoading: doctoraliaLoading } = useQuery({
    enabled: source === "doctoralia" && Boolean(search.from) && Boolean(search.to),
    queryFn: async () => {
      const appointments = await fetchDoctoraliaCalendarAppointments({
        from: search.from!,
        to: search.to!,
        scheduleIds: doctoraliaScheduleIds.length > 0 ? doctoraliaScheduleIds : undefined,
      });
      return toCalendarEventDetail(appointments);
    },
    queryKey: [
      "doctoralia",
      "calendar",
      "appointments",
      search.from,
      search.to,
      doctoraliaScheduleIds,
    ],
  });

  // Local state for filter draft (not applicable until the user clicks Apply)
  const [draftFilters, setDraftFilters] = React.useState(appliedFilters);

  // Sync draft with applied filters only when popover is closed or on initial load
  // To ensure the draft starts from the current view when opened
  React.useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters(appliedFilters);
    }
  }, [appliedFilters, filtersOpen]);

  // Purely derived state from the URL (Source of Truth)
  const actualWeekStart = getActualWeekStart();
  const currentWeekStartStr = search.from ?? actualWeekStart.format(DATE_FORMAT);
  const currentDisplayed = dayjs(currentWeekStartStr, DATE_FORMAT);

  // The hook already filters events by the 'from'/'to' range in the URL.
  // No need to re-filter on the client.
  const displayedWeekEvents = isGoogleSource
    ? (daily?.days.flatMap((day) => day.events) ?? [])
    : doctoraliaEvents;

  // Navigation helpers
  const rangeLabel = currentDisplayed.isValid()
    ? `${currentDisplayed.format("D MMM")} - ${currentDisplayed.add(5, "day").format("D MMM YYYY")}`
    : "Seleccionar rango";

  const isCurrentWeek = currentDisplayed.isSame(actualWeekStart, "day");
  const isNextWeek = currentDisplayed.isSame(actualWeekStart.add(1, "week"), "day");

  const updateWeek = (newStart: string) => {
    const start = dayjs(newStart);
    const end = start.add(6, "day");

    void navigate({
      search: {
        ...search,
        from: start.format(DATE_FORMAT),
        to: end.format(DATE_FORMAT),
      },
    });
  };

  const goToPreviousWeek = () => {
    updateWeek(currentDisplayed.subtract(1, "week").format(DATE_FORMAT));
  };

  const goToNextWeek = () => {
    updateWeek(currentDisplayed.add(1, "week").format(DATE_FORMAT));
  };

  const goToThisWeek = () => {
    updateWeek(actualWeekStart.format(DATE_FORMAT));
  };

  return (
    <section className="space-y-4">
      {/* Compact Header */}
      <header className="space-y-3">
        {/* Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          {/* Left: Week Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <ButtonGroup size="sm" variant="tertiary">
              <Button
                aria-label="Semana anterior"
                isIconOnly
                onPress={goToPreviousWeek}
                variant="ghost"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                className="font-medium text-[11px] uppercase tracking-wide"
                isDisabled={isCurrentWeek}
                onPress={goToThisWeek}
                variant="tertiary"
              >
                <span className="hidden sm:inline">Semana actual</span>
                <span className="sm:hidden">Actual</span>
              </Button>
              <Button
                aria-label="Semana siguiente"
                isIconOnly
                onPress={goToNextWeek}
                variant="ghost"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </ButtonGroup>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="font-medium text-default-600">{rangeLabel}</span>
              {isNextWeek && (
                <Chip size="sm" variant="secondary" color="default" className="text-[11px]">
                  Próxima semana
                </Chip>
              )}
            </div>
          </div>

          {/* Right: Event count + Filter toggle */}
          <div className="flex items-center gap-3">
            <Select
              className="min-w-44"
              selectedKey={source}
              onSelectionChange={(key) => {
                const nextSource = String(key);
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    source: nextSource === "google" ? undefined : "doctoralia",
                    ...(nextSource === "doctoralia"
                      ? {
                          calendarId: undefined,
                          category: [],
                          search: undefined,
                        }
                      : {}),
                  }),
                });
              }}
            >
              <Label className="font-medium text-default-500 text-xs">Fuente</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="google" textValue="Google Calendar">
                    Google Calendar
                  </ListBox.Item>
                  <ListBox.Item id="doctoralia" textValue="Doctoralia Calendar">
                    Doctoralia Calendar
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            {(isGoogleSource ? summary : true) && (
              <span className="text-default-400 text-xs">
                {numberFormatter.format(
                  isGoogleSource ? (summary?.totals.events ?? 0) : displayedWeekEvents.length,
                )}{" "}
                eventos
              </span>
            )}
            {isGoogleSource && (
              <CalendarFiltersPopover
                applyCount={displayedWeekEvents.length}
                availableCategories={availableCategories}
                className="shadow-lg"
                filters={draftFilters}
                isDirty={JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters)}
                isOpen={filtersOpen}
                layout="dropdown"
                loading={loading}
                onApply={() => {
                  void navigate({
                    search: {
                      ...search,
                      calendarId: draftFilters.calendarIds?.length
                        ? draftFilters.calendarIds
                        : undefined,
                      category: draftFilters.categories,
                      search: draftFilters.search || undefined,
                    },
                  });
                  setFiltersOpen(false);
                }}
                onFilterChange={(key, value) => {
                  setDraftFilters((prev) => ({ ...prev, [key]: value }));
                }}
                onOpenChange={setFiltersOpen}
                onReset={() => {
                  setDraftFilters(defaults);
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      calendarId: undefined,
                      category: [],
                      search: undefined,
                    }),
                  });
                }}
                showSearch
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:hidden">
          <span className="font-medium text-default-500">{rangeLabel}</span>
          {isNextWeek && (
            <Chip size="sm" variant="secondary" color="default" className="text-[11px]">
              Próxima semana
            </Chip>
          )}
        </div>
      </header>

      {/* Calendar - Main Content */}
      <Surface
        className="mt-3 overflow-hidden rounded-3xl border border-default-100 shadow-sm"
        variant="default"
      >
        {(isGoogleSource ? loading : doctoraliaLoading) && !displayedWeekEvents.length ? (
          <div className="p-6">
            <CalendarSkeleton days={6} />
          </div>
        ) : (
          <ScheduleCalendar
            events={displayedWeekEvents}
            loading={isGoogleSource ? loading : doctoraliaLoading}
            weekStart={currentWeekStartStr}
          />
        )}
      </Surface>
    </section>
  );
}
export { CalendarSchedulePage };
