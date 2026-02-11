import { ButtonGroup, Chip, Label, ListBox, Select, Surface } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { ScheduleCalendar } from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import type { CalendarEventDetail } from "@/features/calendar/types";
import {
  fetchDoctoraliaCalendarAppointments,
  fetchDoctoraliaCalendarAuthStatus,
} from "@/features/doctoralia/api";
import { useCan } from "@/hooks/use-can";
import { useDisclosure } from "@/hooks/use-disclosure";
import { numberFormatter } from "@/lib/format";

const routeApi = getRouteApi("/_authed/calendar/schedule");
import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";
type CalendarSource = "doctoralia" | "google";
const DOCTORALIA_STANDBY = true;

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

async function waitForDoctoraliaOAuthPopup(popup: Window, origin: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado para OAuth de Doctoralia."));
    }, 180_000);

    const interval = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Ventana OAuth cerrada antes de completar la conexión."));
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) {
        return;
      }

      const data = event.data as { message?: string; source?: string; status?: string };
      if (data?.source !== "doctoralia-calendar-oauth") {
        return;
      }

      cleanup();
      if (data.status === "success") {
        resolve();
        return;
      }

      reject(new Error(data.message || "No se pudo conectar Doctoralia."));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener("message", onMessage);
    };

    window.addEventListener("message", onMessage);
  });
}

function useDoctoraliaCalendarAuth(params: {
  canConnectDoctoralia: boolean;
  isDoctoraliaSource: boolean;
}) {
  const { canConnectDoctoralia, isDoctoraliaSource } = params;
  const queryClient = useQueryClient();
  const [isConnectingDoctoralia, setIsConnectingDoctoralia] = React.useState(false);

  const { data: doctoraliaAuthStatus, isLoading: doctoraliaAuthLoading } = useQuery({
    enabled: isDoctoraliaSource && canConnectDoctoralia,
    queryFn: fetchDoctoraliaCalendarAuthStatus,
    queryKey: ["doctoralia", "calendar", "auth-status"],
    staleTime: 30_000,
  });

  const onConnectDoctoralia = useCallback(async () => {
    setIsConnectingDoctoralia(true);
    try {
      const popup = window.open(
        "/api/doctoralia/calendar/auth/redirect",
        "doctoralia-oauth",
        "popup,width=640,height=840",
      );
      if (!popup) {
        throw new Error("No se pudo abrir la ventana OAuth (bloqueada por el navegador).");
      }

      await waitForDoctoraliaOAuthPopup(popup, window.location.origin);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["doctoralia", "calendar", "auth-status"] }),
        queryClient.invalidateQueries({ queryKey: ["doctoralia", "calendar", "appointments"] }),
      ]);
    } finally {
      setIsConnectingDoctoralia(false);
    }
  }, [queryClient]);

  return {
    doctoraliaAuthLoading,
    doctoraliaAuthStatus,
    isConnectingDoctoralia,
    onConnectDoctoralia,
  };
}

function useScheduleRange(params: {
  navigate: ReturnType<typeof routeApi.useNavigate>;
  search: ReturnType<typeof routeApi.useSearch>;
}) {
  const { navigate, search } = params;
  const actualWeekStart = getActualWeekStart();
  const currentWeekStartStr = search.from ?? actualWeekStart.format(DATE_FORMAT);
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
      className="min-w-44"
      isDisabled={isDisabled}
      value={source}
      onChange={(key) => onSourceChange(String(key))}
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
    <div className="flex items-center gap-3">
      <CalendarSourceSelector
        isDisabled={sourceSelectorDisabled}
        onSourceChange={onSourceChange}
        source={source}
      />

      <span className="text-default-400 text-xs">
        {numberFormatter.format(totalEvents)} eventos
      </span>

      {isGoogleSource && (
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
      )}
    </div>
  );
}

function CalendarSchedulePage() {
  const { can } = useCan();
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const source: CalendarSource = search.source ?? "google";
  const isGoogleSource = source === "google";
  const isDoctoraliaSource = source === "doctoralia";
  const canConnectDoctoralia = can("update", "DoctoraliaFacility");

  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  const { appliedFilters, availableCategories, daily, defaults, loading, summary } =
    useCalendarEvents({ enabled: isGoogleSource });

  const { data: doctoraliaEvents = [], isLoading: doctoraliaLoading } = useQuery({
    enabled: isDoctoraliaSource && Boolean(search.from) && Boolean(search.to),
    queryFn: async () => {
      if (!search.from || !search.to) {
        return [];
      }
      const appointments = await fetchDoctoraliaCalendarAppointments({
        from: search.from,
        to: search.to,
      });
      return toCalendarEventDetail(appointments);
    },
    queryKey: ["doctoralia", "calendar", "appointments", search.from, search.to],
  });

  const { onConnectDoctoralia } = useDoctoraliaCalendarAuth({
    canConnectDoctoralia,
    isDoctoraliaSource,
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
      const nextSource = nextSourceKey === "doctoralia" ? "doctoralia" : "google";
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
    },
    [navigate],
  );

  const onApplyGoogleFilters = useCallback(() => {
    void navigate({
      search: {
        ...search,
        calendarId: draftFilters.calendarIds?.length ? draftFilters.calendarIds : undefined,
        category: draftFilters.categories,
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
        category: [],
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
          <div className="flex items-end gap-3">
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
              <Button
                isDisabled={true}
                onPress={() => void onConnectDoctoralia()}
                size="sm"
                variant="secondary"
              >
                Doctoralia en standby
              </Button>
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
