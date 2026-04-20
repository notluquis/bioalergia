import {
  Button,
  ButtonGroup,
  Card,
  Chip,
  Description,
  Skeleton,
  Surface,
  Tabs,
} from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Users,
} from "lucide-react";
import { lazy, startTransition, Suspense, useEffect, useMemo } from "react";
import type React from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { ScheduleCalendar } from "@/features/calendar/components/ScheduleCalendar";
import type { CalendarEventDetail } from "@/features/calendar/types";
import {
  fetchDoctoraliaCalendarMerged,
  fetchDoctoraliaEmailNotifications,
  fetchDoctoraliaEmailStats,
  fetchDoctoraliaSyncLogs,
  triggerDoctoraliaEmailIngest,
  triggerDoctoraliaSync,
} from "@/features/doctoralia/api";
import type {
  DoctoraliaCalendarMerged,
  DoctoraliaEmailNotification,
  DoctoraliaMergedCalendarEntry,
  DoctoraliaSyncLog,
} from "@/features/doctoralia/types";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";
import { numberFormatter } from "@/lib/format";
import { toTitleCase } from "@/lib/person";

import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

type DoctoraliaTabId = "calendario" | "pacientes" | "eventos" | "sincronizacion";

const DOCTORALIA_TAB_IDS = new Set<DoctoraliaTabId>([
  "calendario",
  "pacientes",
  "eventos",
  "sincronizacion",
]);

function isDoctoraliaTabId(value: string): value is DoctoraliaTabId {
  return DOCTORALIA_TAB_IDS.has(value as DoctoraliaTabId);
}

const LazyDoctoraliaPatientsPanel = lazy(() =>
  import("@/features/doctoralia/pages/DoctoraliaEmailPatientsPage").then((module) => ({
    default: module.DoctoraliaEmailPatientsPage,
  }))
);

const routeApi = getRouteApi("/_authed/clinical/doctoralia");

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
  return {
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
    status: String(appointment.status),
    summary: toTitleCase(appointment.title) || appointment.title,
    transparency: null,
    visibility: null,
  };
}

function orphanEmailToCalendarEventDetail(n: DoctoraliaEmailNotification): CalendarEventDetail {
  const dateStr = n.appointmentDate
    ? (n.appointmentDate.toISOString().split("T")[0] ?? null)
    : null;
  const dateIso = n.appointmentDate ? n.appointmentDate.toISOString() : null;
  const descParts = [
    n.appointmentService,
    n.appointmentDoctor,
    "📧 Sólo email (sin match en calendario)",
  ].filter(Boolean);
  return {
    calendarId: "doctoralia-email",
    category: null,
    colorId: n.eventType === "CANCELLATION" ? "11" : n.eventType === "MODIFICATION" ? "5" : "8",
    controlIncluded: null,
    description: descParts.length ? descParts.join(" · ") : null,
    endDate: null,
    endDateTime: null,
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: dateStr ?? "",
    eventDateTime: dateIso,
    eventId: n.id,
    eventType: "doctoralia-email",
    eventUpdatedAt: null,
    hangoutLink: null,
    location: n.clinicAddress,
    patientName: n.patientName,
    rawEvent: n,
    startDate: dateStr,
    startDateTime: dateIso,
    startTimeZone: null,
    status: n.eventType,
    summary: `${toTitleCase(n.patientName) || n.patientName}${n.appointmentService ? ` — ${n.appointmentService}` : ""}`,
    transparency: null,
    visibility: null,
  };
}

function mergedToCalendarEventDetails(merged: DoctoraliaCalendarMerged): CalendarEventDetail[] {
  return [
    ...merged.entries.map(mergedEntryToCalendarEventDetail),
    ...merged.orphanEmails.map(orphanEmailToCalendarEventDetail),
  ];
}

function getActualWeekStart() {
  const today = dayjs();
  const base = today.day() === 0 ? today.add(1, "day") : today;
  return base.isoWeekday(1);
}

function CalendarTabPanel() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const actualWeekStart = getActualWeekStart();
  const weekStartStr =
    typeof search.from === "string" ? search.from : actualWeekStart.format(DATE_FORMAT);
  const weekStart = dayjs(weekStartStr, DATE_FORMAT);
  const weekEnd = weekStart.add(6, "day");
  const rangeLabel = weekStart.isValid()
    ? `${weekStart.format("D MMM")} - ${weekEnd.format("D MMM YYYY")}`
    : "Seleccionar rango";
  const isCurrentWeek = weekStart.isSame(actualWeekStart, "day");

  const updateWeek = (newStart: string) => {
    const start = dayjs(newStart, DATE_FORMAT);
    const end = start.add(6, "day");
    void navigate({
      search: (prev) => ({
        ...prev,
        from: start.format(DATE_FORMAT),
        to: end.format(DATE_FORMAT),
      }),
    });
  };

  const { data: mergedData, isLoading } = useQuery({
    enabled: Boolean(search.from) && Boolean(search.to),
    queryFn: async () => {
      if (!search.from || !search.to) return null;
      return fetchDoctoraliaCalendarMerged({ from: search.from, to: search.to });
    },
    queryKey: ["doctoralia", "calendar", "merged", search.from, search.to],
  });

  const events = useMemo(
    () => (mergedData ? mergedToCalendarEventDetails(mergedData) : []),
    [mergedData]
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <ButtonGroup size="sm" variant="tertiary">
            <Button
              aria-label="Semana anterior"
              isIconOnly
              onPress={() => updateWeek(weekStart.subtract(1, "week").format(DATE_FORMAT))}
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              className="font-medium text-[11px] uppercase tracking-wide"
              isDisabled={isCurrentWeek}
              onPress={() => updateWeek(actualWeekStart.format(DATE_FORMAT))}
              variant="tertiary"
            >
              Semana actual
            </Button>
            <Button
              aria-label="Semana siguiente"
              isIconOnly
              onPress={() => updateWeek(weekStart.add(1, "week").format(DATE_FORMAT))}
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </ButtonGroup>
          <span className="font-medium text-default-600 text-sm">{rangeLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mergedData ? (
            <>
              <Chip color="default" size="sm" variant="soft">
                {numberFormatter.format(mergedData.counts.appointments)} citas
              </Chip>
              <Chip color="success" size="sm" variant="soft">
                {numberFormatter.format(mergedData.counts.matchedEmails)} emails matcheados
              </Chip>
              {mergedData.counts.orphanEmails > 0 ? (
                <Chip color="warning" size="sm" variant="soft">
                  {numberFormatter.format(mergedData.counts.orphanEmails)} emails sin match
                </Chip>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      <Surface
        className="overflow-hidden rounded-3xl border border-default-100 shadow-sm"
        variant="default"
      >
        {isLoading && events.length === 0 ? (
          <div className="p-6">
            <CalendarSkeleton days={6} />
          </div>
        ) : (
          <ScheduleCalendar
            events={events}
            loading={isLoading}
            weekStart={weekStart.format(DATE_FORMAT)}
          />
        )}
      </Surface>
    </section>
  );
}

const EVENT_TYPE_LABELS: Record<DoctoraliaEmailNotification["eventType"], string> = {
  BOOKING: "Reserva",
  CANCELLATION: "Cancelación",
  MODIFICATION: "Modificación",
};

const EVENT_TYPE_COLORS: Record<
  DoctoraliaEmailNotification["eventType"],
  React.ComponentProps<typeof Chip>["color"]
> = {
  BOOKING: "success",
  CANCELLATION: "warning",
  MODIFICATION: "accent",
};

const notificationColumns: ColumnDef<DoctoraliaEmailNotification>[] = [
  {
    accessorKey: "patientName",
    cell: ({ row }) => <span className="font-medium">{row.original.patientName}</span>,
    header: "Paciente",
  },
  {
    accessorKey: "patientPhone",
    cell: ({ row }) => row.original.patientPhone ?? "—",
    header: "Teléfono",
  },
  {
    accessorKey: "appointmentDate",
    cell: ({ row }) =>
      row.original.appointmentDate
        ? dayjs(row.original.appointmentDate).tz().format("DD/MM/YYYY HH:mm")
        : "—",
    header: "Fecha cita",
  },
  {
    accessorKey: "appointmentService",
    cell: ({ row }) => (
      <span className="max-w-56 truncate text-sm">{row.original.appointmentService ?? "—"}</span>
    ),
    header: "Servicio",
  },
  {
    accessorKey: "eventType",
    cell: ({ row }) => (
      <Chip color={EVENT_TYPE_COLORS[row.original.eventType]} size="sm" variant="soft">
        {EVENT_TYPE_LABELS[row.original.eventType]}
      </Chip>
    ),
    header: "Evento",
  },
  {
    accessorKey: "appointmentDoctor",
    cell: ({ row }) => row.original.appointmentDoctor ?? "—",
    header: "Profesional",
  },
];

function EventsTabPanel() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const pageIndex = search.page ?? 0;
  const pageSize = search.pageSize ?? 25;

  const { data, isPending, error } = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchDoctoraliaEmailNotifications({ limit: pageSize, offset: pageIndex * pageSize }),
    queryKey: ["doctoralia", "email-notifications", pageIndex, pageSize],
    refetchInterval: 30_000,
  });

  const pagination: PaginationState = { pageIndex, pageSize };
  const notifications = data?.notifications ?? [];
  const pageCount = Math.ceil((data?.total ?? 0) / pageSize);

  const setPagination = (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    void navigate({
      search: (prev) => ({
        ...prev,
        page: next.pageIndex,
        pageSize: next.pageSize,
      }),
    });
  };

  if (isPending) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) {
    return (
      <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-danger-700 text-sm">
        {error instanceof Error ? error.message : "No se pudo cargar la tabla de eventos."}
      </div>
    );
  }

  return (
    <DataTable
      columns={notificationColumns}
      data={notifications as DoctoraliaEmailNotification[]}
      enableExport={false}
      enableGlobalFilter={false}
      onPaginationChange={setPagination}
      pageCount={pageCount}
      pagination={pagination}
      scrollMaxHeight="min(65dvh, 700px)"
    />
  );
}

function MetricPill({
  subtitle,
  title,
  tone,
  value,
}: {
  subtitle: string;
  title: string;
  tone: "accent" | "default" | "primary" | "success" | "warning";
  value: number | string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    accent: "border-accent/20 bg-accent/8 text-accent",
    default: "border-default-200 bg-default-100/70 text-default-700",
    primary: "border-primary/20 bg-primary/8 text-primary",
    success: "border-success/20 bg-success/8 text-success",
    warning: "border-warning/20 bg-warning/8 text-warning",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <Description className="text-[11px] uppercase tracking-wide opacity-75">{title}</Description>
      <div className="mt-1 truncate font-semibold text-base">{value}</div>
      <Description className="text-[11px] opacity-75">{subtitle}</Description>
    </div>
  );
}

const syncLogColumns: ColumnDef<DoctoraliaSyncLog>[] = [
  {
    accessorKey: "startedAt",
    cell: ({ row }) => dayjs(row.original.startedAt).tz().format("DD/MM/YYYY HH:mm"),
    header: "Inicio",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Chip
        color={
          row.original.status === "SUCCESS"
            ? "success"
            : row.original.errorMessage
              ? "danger"
              : "default"
        }
        size="sm"
        variant="soft"
      >
        {row.original.status}
      </Chip>
    ),
    header: "Estado",
  },
  {
    accessorKey: "triggerSource",
    cell: ({ row }) => row.original.triggerSource ?? "—",
    header: "Origen",
  },
  {
    accessorKey: "facilitiesSynced",
    cell: ({ row }) => row.original.facilitiesSynced,
    header: "Centros",
  },
  {
    accessorKey: "doctorsSynced",
    cell: ({ row }) => row.original.doctorsSynced,
    header: "Doctores",
  },
  {
    accessorKey: "bookingsSynced",
    cell: ({ row }) => row.original.bookingsSynced,
    header: "Reservas",
  },
  {
    accessorKey: "errorMessage",
    cell: ({ row }) => (
      <span className="max-w-64 truncate text-danger-600 text-xs">
        {row.original.errorMessage ?? "—"}
      </span>
    ),
    header: "Error",
  },
];

function SyncTabPanel() {
  const { error: showError, success: showSuccess } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isPending: statsPending } = useQuery({
    queryFn: fetchDoctoraliaEmailStats,
    queryKey: ["doctoralia", "email-stats"],
    refetchInterval: 30_000,
  });

  const { data: logs = [], isPending: logsPending } = useQuery({
    queryFn: fetchDoctoraliaSyncLogs,
    queryKey: ["doctoralia", "sync-logs"],
    refetchInterval: 60_000,
  });

  const ingestMutation = useMutation({
    mutationFn: triggerDoctoraliaEmailIngest,
    onError: (err: Error) => showError(`Error al disparar la ingesta: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "error") {
        showError(result.message, "Ingesta fallida");
        return;
      }
      showSuccess(result.message, "Ingesta completada");
      void queryClient.invalidateQueries({ queryKey: ["doctoralia"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: triggerDoctoraliaSync,
    onError: (err: Error) => showError(`Error al sincronizar: ${err.message}`),
    onSuccess: () => {
      showSuccess("Sincronización iniciada");
      void queryClient.invalidateQueries({ queryKey: ["doctoralia", "sync-logs"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <Card.Header className="flex flex-col items-start gap-1">
            <h2 className="font-semibold text-base">Actividad de eventos</h2>
            <Description className="text-default-500 text-xs">
              Totales acumulados desde que arrancó el listener IMAP.
            </Description>
          </Card.Header>
          <Card.Content>
            {statsPending ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : stats ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricPill title="Total" subtitle="eventos" tone="primary" value={stats.total} />
                <MetricPill
                  title="Reservas"
                  subtitle="bookings"
                  tone="success"
                  value={stats.bookings}
                />
                <MetricPill
                  title="Modificaciones"
                  subtitle="changes"
                  tone="accent"
                  value={stats.modifications}
                />
                <MetricPill
                  title="Cancelaciones"
                  subtitle="cancellations"
                  tone="warning"
                  value={stats.cancellations}
                />
                <MetricPill
                  title="Con teléfono"
                  subtitle="contactables"
                  tone="success"
                  value={stats.withPhone}
                />
              </div>
            ) : (
              <Description className="text-danger-500 text-sm">
                No se pudo cargar la actividad.
              </Description>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex flex-col items-start gap-1">
            <h2 className="font-semibold text-base">Ejecución manual</h2>
            <Description className="text-default-500 text-xs">
              Fuerza una ingesta IMAP o una sincronización del calendario.
            </Description>
          </Card.Header>
          <Card.Content className="space-y-2">
            <Button
              className="w-full"
              isDisabled={ingestMutation.isPending}
              isPending={ingestMutation.isPending}
              onPress={() => ingestMutation.mutate()}
              variant="primary"
            >
              <RefreshCw className="h-4 w-4" />
              Ingesta de emails
            </Button>
            <Button
              className="w-full"
              isDisabled={syncMutation.isPending}
              isPending={syncMutation.isPending}
              onPress={() => syncMutation.mutate()}
              variant="secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Sync de calendario
            </Button>
          </Card.Content>
        </Card>
      </div>

      {logsPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <DataTable
          columns={syncLogColumns}
          data={logs}
          enableExport={false}
          enableGlobalFilter={false}
          scrollMaxHeight="min(55dvh, 600px)"
        />
      )}
    </div>
  );
}

export function DoctoraliaAnalyticsPage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const selectedTab = (search.tab ?? "calendario") as DoctoraliaTabId;
  const { isTabMounted, markTabAsMounted } = useLazyTabs<DoctoraliaTabId>(selectedTab);

  useEffect(() => {
    markTabAsMounted(selectedTab);
  }, [markTabAsMounted, selectedTab]);

  const tabLoadingFallback = (
    <Card className="max-w-3xl" variant="secondary">
      <Card.Header>
        <Card.Title className="text-sm">Cargando vista</Card.Title>
        <Card.Description>Preparando datos.</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-3">
        <Skeleton className="h-48 rounded-3xl" />
      </Card.Content>
    </Card>
  );

  return (
    <div className="flex h-full min-h-full w-full flex-col gap-4 p-3 md:p-5">
      <Tabs
        aria-label="Secciones de Doctoralia"
        className="flex min-h-0 flex-1 flex-col"
        selectedKey={selectedTab}
        onSelectionChange={(key) => {
          const next = String(key);
          const nextTab: DoctoraliaTabId = isDoctoraliaTabId(next) ? next : "calendario";
          startTransition(() => {
            void navigate({
              search: (prev) => ({
                ...prev,
                tab: nextTab,
              }),
            });
          });
        }}
      >
        <Tabs.ListContainer className="muted-scrollbar overflow-x-auto pb-1">
          <Tabs.List
            aria-label="Tabs de Doctoralia"
            className="w-max min-w-full rounded-lg bg-default-50/50 p-1 whitespace-nowrap"
          >
            <Tabs.Tab id="calendario" className="gap-2">
              <CalendarDays className="size-4" />
              Calendario
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="pacientes" className="gap-2">
              <Users className="size-4" />
              Pacientes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="eventos" className="gap-2">
              <Mail className="size-4" />
              Eventos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="sincronizacion" className="gap-2">
              <Activity className="size-4" />
              Sincronización
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="calendario">
          {isTabMounted("calendario") ? <CalendarTabPanel /> : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="pacientes">
          {isTabMounted("pacientes") ? (
            <Suspense fallback={tabLoadingFallback}>
              <LazyDoctoraliaPatientsPanel />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="eventos">
          {isTabMounted("eventos") ? <EventsTabPanel /> : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="sincronizacion">
          {isTabMounted("sincronizacion") ? <SyncTabPanel /> : null}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
