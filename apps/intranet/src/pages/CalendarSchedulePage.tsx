import { Button, ButtonGroup, Chip, ListBox, Select, Separator, Surface } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback } from "react";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { ScheduleCalendar } from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import type { CalendarEventDetail, CalendarSearchParams } from "@/features/calendar/types";
import { fetchDoctoraliaCalendarMerged } from "@/features/doctoralia/api";
import type {
  DoctoraliaCalendarMerged,
  DoctoraliaEmailNotification,
  DoctoraliaMergedCalendarEntry,
} from "@/features/doctoralia/types";
import { useCan } from "@/hooks/use-can";
import { useDisclosure } from "@/hooks/use-disclosure";
import { numberFormatter } from "@/lib/format";
import { toTitleCase } from "@/lib/person";

const routeApi = getRouteApi("/_authed/clinical/agenda");
import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";
type CalendarSource = "doctoralia" | "google";
const DOCTORALIA_STANDBY = false;

function mergedEntryToCalendarEventDetail(
  entry: DoctoraliaMergedCalendarEntry
): CalendarEventDetail {
  const { appointment, emails } = entry;
  const descParts = [
    appointment.comments,
    emails.cancellation ? "⚠ Cancelado por email" : null,
    emails.modifications.length > 0
      ? `✎ Modificado (${emails.modifications.length}) por email`
      : null,
  ].filter(Boolean);
  const colorId = emails.cancellation
    ? "11"
    : emails.modifications.length > 0
      ? "5"
      : appointment.serviceColorSchemaId != null
        ? String(appointment.serviceColorSchemaId)
        : null;
  // Estado real de Doctoralia (attendance + status) → campos que entiende el
  // event-state genérico. attendance: 3=asistió, 6=no asistió; status: 1=cancelada,
  // 6=confirmada. Email de cancelación también marca no asistió.
  const isCancelled =
    appointment.status === 1 || appointment.attendance === 6 || Boolean(emails.cancellation);
  const attended = appointment.attendance === 3 ? true : isCancelled ? false : null;
  const genericStatus = isCancelled
    ? "cancelled"
    : appointment.attendance === 3 || appointment.status === 6
      ? "confirmed"
      : "needsAction";
  return {
    attended,
    calendarId: `doctoralia:${appointment.schedule.externalId}`,
    category: null,
    colorId,
    controlIncluded: null,
    description: descParts.length ? descParts.join(" · ") : null,
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
    rawEvent: { appointment, emails },
    startDate: appointment.startAt.toISOString().split("T")[0] ?? null,
    startDateTime: appointment.startAt.toISOString(),
    startTimeZone: null,
    status: genericStatus,
    summary: toTitleCase(appointment.title) || appointment.title,
    transparency: null,
    visibility: null,
  };
}

function normalizePatientName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dra?\.?|dr\.?|sra?\.?|sr\.?|srta\.?)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EVENT_PRIORITY: Record<DoctoraliaEmailNotification["eventType"], number> = {
  CANCELLATION: 3,
  MODIFICATION: 2,
  BOOKING: 1,
};

function orphanGroupToCalendarEventDetail(
  group: DoctoraliaEmailNotification[]
): CalendarEventDetail {
  const primary = [...group].sort(
    (a, b) => EVENT_PRIORITY[b.eventType] - EVENT_PRIORITY[a.eventType]
  )[0] as DoctoraliaEmailNotification;
  const hasCancellation = group.some((e) => e.eventType === "CANCELLATION");
  const hasModification = group.some((e) => e.eventType === "MODIFICATION");
  const hasBooking = group.some((e) => e.eventType === "BOOKING");
  const dateStr = primary.appointmentDate
    ? (primary.appointmentDate.toISOString().split("T")[0] ?? null)
    : null;
  const dateIso = primary.appointmentDate ? primary.appointmentDate.toISOString() : null;
  const statusBits = [
    hasCancellation ? "Cancelado" : null,
    hasModification ? "Modificado" : null,
    hasBooking && !hasCancellation && !hasModification ? "Reservado" : null,
  ].filter(Boolean);
  const descParts = [
    primary.appointmentService,
    primary.appointmentDoctor,
    `📧 ${statusBits.join(" + ")} por email (sin match en calendario)`,
  ].filter(Boolean);
  const colorId = hasCancellation ? "11" : hasModification ? "5" : "8";
  return {
    calendarId: "doctoralia-email",
    category: null,
    colorId,
    controlIncluded: null,
    description: descParts.length ? descParts.join(" · ") : null,
    endDate: null,
    endDateTime: null,
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: dateStr ?? "",
    eventDateTime: dateIso,
    eventId: group.map((e) => e.id).join("+"),
    eventType: "doctoralia-email",
    eventUpdatedAt: null,
    hangoutLink: null,
    location: primary.clinicAddress,
    patientName: primary.patientName,
    rawEvent: { group, primary },
    startDate: dateStr,
    startDateTime: dateIso,
    startTimeZone: null,
    status: primary.eventType,
    summary: `${toTitleCase(primary.patientName) || primary.patientName}${primary.appointmentService ? ` — ${primary.appointmentService}` : ""}`,
    transparency: null,
    visibility: null,
  };
}

function mergedToCalendarEventDetails(merged: DoctoraliaCalendarMerged): CalendarEventDetail[] {
  const orphanGroups = new Map<string, DoctoraliaEmailNotification[]>();
  const ungrouped: DoctoraliaEmailNotification[] = [];
  for (const email of merged.orphanEmails) {
    if (!email.appointmentDate) {
      ungrouped.push(email);
      continue;
    }
    const minute = Math.floor(email.appointmentDate.getTime() / 60_000);
    const key = `${normalizePatientName(email.patientName)}|${minute}`;
    const bucket = orphanGroups.get(key) ?? [];
    bucket.push(email);
    orphanGroups.set(key, bucket);
  }
  return [
    ...merged.entries.map(mergedEntryToCalendarEventDetail),
    ...Array.from(orphanGroups.values()).map(orphanGroupToCalendarEventDetail),
    ...ungrouped.map((e) => orphanGroupToCalendarEventDetail([e])),
  ];
}

function useScheduleRange(params: {
  navigate: ReturnType<typeof routeApi.useNavigate>;
  search: CalendarSearchParams;
}) {
  const { navigate, search } = params;
  const actualWeekStart = getActualWeekStart();
  // Type-safe: ensure search.from is string or fallback to current week
  const currentWeekStartStr: string =
    (typeof search?.from === "string" ? search.from : null) ?? actualWeekStart.format(DATE_FORMAT);
  const currentDisplayed = dayjs(currentWeekStartStr, DATE_FORMAT);

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

  return {
    currentWeekStartStr,
    goToNextWeek,
    goToPreviousWeek,
    goToThisWeek,
    isCurrentWeek,
    isNextWeek,
    rangeLabel,
  };
}

// Logic moved to validateSearch in route, but we still use it for comparison logic
const getActualWeekStart = () => {
  const today = dayjs();
  const base = today.day() === 0 ? today.add(1, "day") : today;
  return base.isoWeekday(1);
};

function CalendarSourceSelector({
  isDisabled,
  onSourceChange,
  source,
}: Readonly<{
  isDisabled: boolean;
  onSourceChange: (key: string) => void;
  source: CalendarSource;
}>) {
  return (
    <Select
      aria-label="Fuente del calendario"
      className="min-w-48"
      isDisabled={isDisabled}
      value={source}
      onChange={(key) => {
        if (key) {
          onSourceChange(String(key));
        }
      }}
    >
      <Select.Trigger className="h-9">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="google" textValue="Google Calendar">
            Google Calendar
          </ListBox.Item>
          <ListBox.Item id="doctoralia" textValue="Doctoralia">
            Doctoralia
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function ScheduleHeaderControls({
  appliedFilters,
  availableCategories,
  draftFilters,
  filtersOpen,
  isGoogleSource,
  loading,
  onApplyGoogleFilters,
  onFilterChange,
  onResetGoogleFilters,
  onSourceChange,
  setFiltersOpen,
  sourceSelectorDisabled,
  source,
  totalEvents,
}: Readonly<{
  appliedFilters: ReturnType<typeof useCalendarEvents>["appliedFilters"];
  availableCategories: ReturnType<typeof useCalendarEvents>["availableCategories"];
  draftFilters: ReturnType<typeof useCalendarEvents>["appliedFilters"];
  filtersOpen: boolean;
  isGoogleSource: boolean;
  loading: boolean;
  onApplyGoogleFilters: () => void;
  onFilterChange: (key: string, value: unknown) => void;
  onResetGoogleFilters: () => void;
  onSourceChange: (key: string) => void;
  setFiltersOpen: (open: boolean) => void;
  sourceSelectorDisabled: boolean;
  source: CalendarSource;
  totalEvents: number;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarSourceSelector
        isDisabled={sourceSelectorDisabled}
        onSourceChange={onSourceChange}
        source={source}
      />

      <Chip size="sm" variant="soft" color="default" className="tabular-nums">
        {numberFormatter.format(totalEvents)} eventos
      </Chip>

      {isGoogleSource && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <CalendarFiltersPopover
            applyCount={totalEvents}
            availableCategories={availableCategories}
            className="shadow-lg"
            filters={draftFilters}
            isDirty={JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters)}
            isOpen={filtersOpen}
            layout="dropdown"
            loading={loading}
            onApply={onApplyGoogleFilters}
            onFilterChange={onFilterChange}
            onOpenChange={setFiltersOpen}
            onReset={onResetGoogleFilters}
            showSearch
          />
        </>
      )}
    </div>
  );
}

function CalendarSchedulePage() {
  const { can } = useCan();
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const source: CalendarSource = (search.source as CalendarSource) ?? "google";
  const isGoogleSource = source === "google";
  const isDoctoraliaSource = source === "doctoralia";
  const canConnectDoctoralia = can("update", "DoctoraliaCalendarAppointment");

  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  const { appliedFilters, availableCategories, daily, defaults, loading, summary } =
    useCalendarEvents({ enabled: isGoogleSource });

  const { data: doctoraliaEvents = [], isLoading: doctoraliaLoading } = useQuery({
    enabled: isDoctoraliaSource && Boolean(search.from) && Boolean(search.to),
    queryFn: async () => {
      if (!search.from || !search.to) {
        return [];
      }
      const merged = await fetchDoctoraliaCalendarMerged({
        from: search.from,
        to: search.to,
      });
      return mergedToCalendarEventDetails(merged);
    },
    queryKey: ["doctoralia", "calendar", "merged", search.from, search.to],
  });

  // Local state for filter draft (not applicable until the user clicks Apply)
  const [draftFilters, setDraftFilters] = React.useState(appliedFilters);
  const serializedAppliedFilters = JSON.stringify(appliedFilters);

  // Sync draft with applied filters only when popover is closed or on initial load
  // To ensure the draft starts from the current view when opened
  React.useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters((prev) =>
        JSON.stringify(prev) === serializedAppliedFilters ? prev : appliedFilters
      );
    }
  }, [appliedFilters, filtersOpen, serializedAppliedFilters]);
  const {
    currentWeekStartStr,
    goToNextWeek,
    goToPreviousWeek,
    goToThisWeek,
    isCurrentWeek,
    isNextWeek,
    rangeLabel,
  } = useScheduleRange({
    navigate,
    search,
  });

  // The hook already filters events by the 'from'/'to' range in the URL.
  // No need to re-filter on the client.
  const displayedWeekEvents = isGoogleSource
    ? (daily?.days.flatMap((day) => day.events) ?? [])
    : doctoraliaEvents;

  const onSourceChange = useCallback(
    (nextSourceKey: string) => {
      const nextSource = nextSourceKey as CalendarSource;
      const isNonGoogle = nextSource !== "google";
      void navigate({
        search: (prev) => ({
          ...prev,
          source: nextSource === "google" ? undefined : nextSource,
          ...(isNonGoogle
            ? {
                calendarId: undefined,
                category: undefined,
                search: undefined,
              }
            : {}),
        }),
      });
    },
    [navigate]
  );

  const onApplyGoogleFilters = useCallback(() => {
    void navigate({
      search: {
        ...search,
        calendarId: draftFilters.calendarIds?.length ? draftFilters.calendarIds : undefined,
        category: draftFilters.categories.length ? draftFilters.categories : undefined,
        search: draftFilters.search || undefined,
      },
    });
    setFiltersOpen(false);
  }, [draftFilters, navigate, search, setFiltersOpen]);

  const onResetGoogleFilters = useCallback(() => {
    setDraftFilters(defaults);
    void navigate({
      search: (prev) => ({
        ...prev,
        calendarId: undefined,
        category: undefined,
        search: undefined,
      }),
    });
  }, [defaults, navigate]);

  const totalEvents = isGoogleSource ? (summary?.totals.events ?? 0) : displayedWeekEvents.length;
  const calendarLoading = isGoogleSource ? loading : doctoraliaLoading;
  const onFilterChange = useCallback((key: string, value: unknown) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <section className="space-y-4">
      {/* Compact Header */}
      <header className="space-y-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          {/* Left: Week Navigation */}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <ButtonGroup size="sm" variant="tertiary">
              <Button
                aria-label="Semana anterior"
                isIconOnly
                onPress={goToPreviousWeek}
                variant="outline"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                className="font-medium text-xs"
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
                variant="outline"
              >
                <ChevronRight className="size-4" />
              </Button>
            </ButtonGroup>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="font-medium text-default-600">{rangeLabel}</span>
              {isNextWeek && (
                <Chip size="sm" variant="soft" color="default">
                  Próxima semana
                </Chip>
              )}
            </div>
          </div>

          {/* Right: Source + count + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <ScheduleHeaderControls
              appliedFilters={appliedFilters}
              availableCategories={availableCategories}
              draftFilters={draftFilters}
              filtersOpen={filtersOpen}
              isGoogleSource={isGoogleSource}
              loading={loading}
              onApplyGoogleFilters={onApplyGoogleFilters}
              onFilterChange={onFilterChange}
              onResetGoogleFilters={onResetGoogleFilters}
              onSourceChange={onSourceChange}
              setFiltersOpen={setFiltersOpen}
              sourceSelectorDisabled={DOCTORALIA_STANDBY}
              source={source}
              totalEvents={totalEvents}
            />
            {isDoctoraliaSource && canConnectDoctoralia && (
              <Chip size="sm" variant="soft" color="warning">
                En standby
              </Chip>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:hidden">
          <span className="font-medium text-default-500">{rangeLabel}</span>
          {isNextWeek && (
            <Chip size="sm" variant="soft" color="default">
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
        {calendarLoading && !displayedWeekEvents.length ? (
          <div className="p-6">
            <CalendarSkeleton days={6} />
          </div>
        ) : (
          <ScheduleCalendar
            events={displayedWeekEvents}
            loading={calendarLoading}
            weekStart={currentWeekStartStr}
          />
        )}
      </Surface>
    </section>
  );
}
export { CalendarSchedulePage };
