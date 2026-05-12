import { Button, Card, Chip, Description, Skeleton, Tabs } from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { Activity, BarChart3, Mail, RefreshCw, TrendingUp, Users } from "lucide-react";
import { lazy, startTransition, Suspense, useEffect, useMemo } from "react";
import type React from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { doctoraliaAnalyticsKeys } from "@/features/doctoralia/analytics/queries";
import type { DoctoraliaMetricKey } from "@/features/doctoralia/analytics/types";
import {
  extractDoctoraliaYearsFromSummary,
  safeDoctoraliaYearSelection,
} from "@/features/doctoralia/analytics/utils";
import {
  fetchDoctoraliaEmailNotifications,
  fetchDoctoraliaEmailStats,
  fetchDoctoraliaSyncLogs,
  triggerDoctoraliaEmailIngest,
} from "@/features/doctoralia/api";
import type { DoctoraliaEmailNotification, DoctoraliaSyncLog } from "@/features/doctoralia/types";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";
import { numberFormatter } from "@/lib/format";

import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.locale("es");

type DoctoraliaTabId = "mensual" | "comparativa" | "pacientes" | "eventos" | "sincronizacion";

const DOCTORALIA_TAB_IDS = new Set<DoctoraliaTabId>([
  "mensual",
  "comparativa",
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

const LazyDoctoraliaMonthlyPanel = lazy(() =>
  import("@/features/doctoralia/analytics/components/DoctoraliaMonthlyPanel").then((module) => ({
    default: module.DoctoraliaMonthlyPanel,
  }))
);

const LazyDoctoraliaComparisonPanel = lazy(() =>
  import("@/features/doctoralia/analytics/components/DoctoraliaComparisonPanel").then((module) => ({
    default: module.DoctoraliaComparisonPanel,
  }))
);

const routeApi = getRouteApi("/_authed/clinical/doctoralia");

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
      <Description className="text-[11px] opacity-75">{title}</Description>
      <div className="mt-1 truncate font-semibold text-base">{value}</div>
      <Description className="text-xs opacity-75">{subtitle}</Description>
    </div>
  );
}

const SYNC_TYPE_LABELS: Record<DoctoraliaSyncLog["syncType"], string> = {
  CALENDAR: "Calendario",
  EMAIL: "Email",
};

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, v]) => typeof v === "number");
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${numberFormatter.format(v)}`).join(" · ");
}

const syncLogColumns: ColumnDef<DoctoraliaSyncLog>[] = [
  {
    accessorKey: "startedAt",
    cell: ({ row }) => dayjs(row.original.startedAt).tz().format("DD/MM/YYYY HH:mm"),
    header: "Inicio",
  },
  {
    accessorKey: "syncType",
    cell: ({ row }) => (
      <Chip color="default" size="sm" variant="soft">
        {SYNC_TYPE_LABELS[row.original.syncType]}
      </Chip>
    ),
    header: "Tipo",
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
    accessorKey: "counts",
    cell: ({ row }) => (
      <span className="text-xs text-default-600">{formatCounts(row.original.counts)}</span>
    ),
    header: "Contadores",
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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <Card.Header className="flex flex-col items-start gap-1">
            <h2 className="font-semibold text-base">Actividad de eventos</h2>
            <Card.Description className="text-default-500 text-xs">
              Totales acumulados desde que arrancó el listener IMAP.
            </Card.Description>
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
            <Card.Description className="text-default-500 text-xs">
              Fuerza una ingesta IMAP de emails de Doctoralia.
            </Card.Description>
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
  const selectedTab = (search.tab ?? "mensual") as DoctoraliaTabId;
  const { isTabMounted, markTabAsMounted } = useLazyTabs<DoctoraliaTabId>(selectedTab);

  useEffect(() => {
    markTabAsMounted(selectedTab);
  }, [markTabAsMounted, selectedTab]);

  // Load all-year summary to drive the year selector and comparison chart.
  const { data: allSummary } = useSuspenseQuery(doctoraliaAnalyticsKeys.monthlySummary());

  const currentYear = new Date().getFullYear().toString();
  const yearOptions = useMemo(() => {
    const extracted = extractDoctoraliaYearsFromSummary(allSummary);
    if (extracted.length > 0) return extracted;
    return [currentYear];
  }, [allSummary, currentYear]);

  const selectedYear = useMemo(() => {
    const requested = search.year ? String(search.year) : currentYear;
    return safeDoctoraliaYearSelection(requested, yearOptions);
  }, [search.year, yearOptions, currentYear]);

  const setSelectedYear = (year: string) => {
    const parsed = Number(year);
    void navigate({
      search: (prev) => ({
        ...prev,
        year: Number.isFinite(parsed) ? parsed : undefined,
      }),
    });
  };

  const setCompareMetric = (metric: DoctoraliaMetricKey) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        compareMetric: metric,
      }),
    });
  };

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
          const nextTab: DoctoraliaTabId = isDoctoraliaTabId(next) ? next : "mensual";
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
            <Tabs.Tab id="mensual" className="gap-2">
              <BarChart3 className="size-4" />
              Mensual
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="comparativa" className="gap-2">
              <TrendingUp className="size-4" />
              Comparativa
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

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="mensual">
          {isTabMounted("mensual") ? (
            <Suspense fallback={tabLoadingFallback}>
              <LazyDoctoraliaMonthlyPanel
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                yearOptions={yearOptions}
              />
            </Suspense>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 pt-2 sm:pt-4" id="comparativa">
          {isTabMounted("comparativa") ? (
            <Suspense fallback={tabLoadingFallback}>
              <LazyDoctoraliaComparisonPanel
                metric={search.compareMetric ?? "total"}
                setMetric={setCompareMetric}
              />
            </Suspense>
          ) : null}
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
