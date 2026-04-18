import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  ProgressBar,
  Skeleton,
  Surface,
  Tabs,
} from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Activity,
  AlertCircle,
  Cookie,
  Mail,
  MessageCircleReply,
  RefreshCw,
  Send,
  Workflow,
} from "lucide-react";

import { DoctoraliaCookieStorePanel } from "@/features/doctoralia/components/DoctoraliaCookieStorePanel";
import type React from "react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { triggerDoctoraliaEmailIngest } from "@/features/doctoralia/settings-api";
import { doctoraliaSettingsKeys } from "@/features/doctoralia/settings-queries";
import { PAGE_CONTAINER } from "@/lib/styles";
import { ChecklistRow, FlowStep } from "./messaging-settings-shared";
import type { DoctoraliaEmailNotification } from "@/features/doctoralia/types";

export function DoctoraliaSettingsPage() {
  const { error: showError, success: showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });

  const limit = pagination.pageSize;
  const offset = pagination.pageIndex * pagination.pageSize;

  const { data: overview, isPending: overviewPending } = useQuery({
    ...doctoraliaSettingsKeys.overview(),
    refetchInterval: 30_000,
  });

  const { data: stats, isPending: statsPending } = useQuery({
    ...doctoraliaSettingsKeys.stats(),
    refetchInterval: 30_000,
  });

  const {
    data: notificationsData,
    error: notificationsError,
    isPending: notificationsPending,
  } = useQuery({
    ...doctoraliaSettingsKeys.notifications({ limit, offset }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
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
      void queryClient.invalidateQueries({ queryKey: doctoraliaSettingsKeys.all });
    },
  });

  const notifications = notificationsData?.notifications ?? [];
  const pageCount = Math.ceil((notificationsData?.total ?? 0) / limit);

  const readiness = useMemo(() => {
    if (!overview) return 0;
    const checks = [
      overview.imapHostConfigured,
      overview.imapUserConfigured,
      overview.imapPassConfigured,
      overview.listener.state === "connected",
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [overview]);

  const missingBlocks = useMemo(() => {
    if (!overview) return [];
    const items: string[] = [];
    if (!overview.imapHostConfigured) items.push("host IMAP");
    if (!overview.imapUserConfigured) items.push("usuario IMAP");
    if (!overview.imapPassConfigured) items.push("password IMAP");
    if (overview.listener.state !== "connected") items.push("listener IMAP");
    return items;
  }, [overview]);

  const listenerSummary = useMemo(() => {
    const listener = overview?.listener;
    if (!listener) return null;

    const stateMeta: Record<
      typeof listener.state,
      { description: string; tone: "accent" | "default" | "success" | "warning" }
    > = {
      connected: {
        description: "Conexión activa al buzón y espera de nuevos correos.",
        tone: "success",
      },
      connecting: {
        description: "Intentando abrir la conexión IMAP del buzón configurado.",
        tone: "accent",
      },
      error: {
        description: "La conexión IMAP falló y quedó esperando reintento.",
        tone: "warning",
      },
      missing_config: {
        description: "El listener está habilitado, pero faltan variables IMAP.",
        tone: "warning",
      },
      stopped: {
        description: listener.enabled
          ? "El proceso todavía no inició el listener IMAP."
          : "El listener IMAP no está habilitado en este entorno.",
        tone: "default",
      },
    };

    const meta = stateMeta[listener.state];
    return {
      ...meta,
      label: listener.state.replaceAll("_", " "),
    };
  }, [overview]);

  return (
    <div className={PAGE_CONTAINER}>
      <Tabs defaultSelectedKey="overview">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones de Doctoralia">
            <Tabs.Tab id="overview">
              Ingesta
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="flow">
              Flujo
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="activity">
              Actividad
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="scraper">
              Bot scraper
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="overview">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Estado de la ingesta</h2>
                <Description className="text-default-500 text-xs">
                  Esto cubre configuración IMAP, estado del listener y registro de eventos de
                  correo.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                {overviewPending ? (
                  <Skeleton className="h-80 w-full rounded-2xl" />
                ) : overview ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Description className="text-default-500 text-xs uppercase tracking-wide">
                          Preparación de Doctoralia
                        </Description>
                        <span className="font-semibold text-sm">{readiness}%</span>
                      </div>
                      <ProgressBar aria-label="Preparación de Doctoralia" value={readiness}>
                        <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                          <ProgressBar.Fill className="bg-warning" />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>

                    <ChecklistRow
                      description="Servidor IMAP configurado para revisar el buzón de notificaciones."
                      icon={Mail}
                      ready={overview.imapHostConfigured}
                      title="Host IMAP"
                    />
                    <ChecklistRow
                      description="Usuario IMAP presente para autenticarse en el buzón."
                      icon={Mail}
                      ready={overview.imapUserConfigured}
                      title="Usuario IMAP"
                    />
                    <ChecklistRow
                      description="Password IMAP disponible para lectura del correo."
                      icon={Mail}
                      ready={overview.imapPassConfigured}
                      title="Password IMAP"
                    />
                    <ChecklistRow
                      description={listenerSummary?.description ?? "Estado real del listener IMAP."}
                      icon={Activity}
                      ready={overview.listener.state === "connected"}
                      title="Listener IMAP"
                    />
                  </>
                ) : (
                  <Alert status="danger">No se pudo cargar el estado de Doctoralia.</Alert>
                )}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Parámetros del flujo</h2>
                <Description className="text-default-500 text-xs">
                  Valores activos que afectan cómo entra el correo y cómo se registra la ingesta.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Mailbox
                  </Description>
                  <p className="mt-1 font-medium text-sm">{overview?.imapMailbox ?? "INBOX"}</p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Filtro de remitente
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {overview?.senderFilter ?? "doctoralia.com"}
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Usuario conectado
                  </Description>
                  <p className="mt-1 font-medium text-sm">{overview?.listener.user ?? "—"}</p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Estado del listener
                  </Description>
                  <p className="mt-1 font-medium text-sm">{listenerSummary?.label ?? "—"}</p>
                  <Description className="text-default-500 text-xs">
                    {listenerSummary?.description ?? "Sin telemetría del listener."}
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Última conexión
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {formatStatusDate(overview?.listener.lastConnectedAt)}
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Último correo procesado
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {formatStatusDate(overview?.listener.lastProcessedAt)}
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Siguiente etapa
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    WhatsApp y automatizaciones posteriores
                  </p>
                  <Description className="text-default-500 text-xs">
                    Esta pantalla valida primero que el correo entre y se guarde en la base de
                    datos.
                  </Description>
                </Surface>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="flow">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <Card.Header className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-base">Flujo Doctoralia → WhatsApp</h2>
                  <Description className="text-default-500 text-xs">
                    El flujo correcto es correo Doctoralia → parseo → base de datos →
                    automatizaciones posteriores.
                  </Description>
                </div>
                <Button
                  isDisabled={ingestMutation.isPending}
                  isPending={ingestMutation.isPending}
                  onPress={() => ingestMutation.mutate()}
                  size="sm"
                  variant="secondary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Ejecutar ingesta
                </Button>
              </Card.Header>
              <Card.Content className="space-y-3">
                <FlowStep
                  body="El listener IMAP mantiene el buzón abierto y reacciona cuando llega un correo nuevo."
                  icon={Mail}
                  step="01"
                  title="Lectura del buzón"
                />
                <FlowStep
                  body="Se valida que el correo sea realmente de Doctoralia y se extraen nombre, teléfono, fecha y servicio."
                  icon={Workflow}
                  step="02"
                  title="Parseo de la reserva"
                />
                <FlowStep
                  body="El evento se guarda en la tabla de notificaciones de correo de Doctoralia como fuente de verdad."
                  icon={MessageCircleReply}
                  step="03"
                  title="Persistencia en base de datos"
                />
                <FlowStep
                  body="Después, otros módulos como WhatsApp pueden consumir esos eventos y disparar mensajes automáticos."
                  icon={Send}
                  step="04"
                  title="Automatizaciones posteriores"
                />
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Observaciones</h2>
                <Description className="text-default-500 text-xs">
                  Lo que le corresponde a Doctoralia dentro del flujo.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                {!overviewPending && overview && missingBlocks.length > 0 ? (
                  <Alert status="warning">
                    <Alert.Content>
                      <Alert.Description>
                        La ingesta aún no está completa. Falta: {missingBlocks.join(", ")}.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}

                {!overviewPending && overview?.listener.lastErrorMessage ? (
                  <Alert status="warning">
                    <Alert.Indicator>
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>
                        <p className="font-medium text-sm">Último error IMAP</p>
                        <Description className="text-xs">
                          {overview.listener.lastErrorMessage}
                        </Description>
                        <Description className="text-default-500 text-xs">
                          {formatStatusDate(overview.listener.lastErrorAt)}
                        </Description>
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Responsabilidad de Doctoralia
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Detectar, validar y guardar el correo en la base de datos
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Responsabilidad de WhatsApp
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Consumir esos eventos si existe una automatización de salida configurada
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Métrica operativa
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {stats?.total ?? 0} eventos Doctoralia guardados
                  </p>
                  <Description className="text-default-500 text-xs">
                    Esta vista ya no depende del despacho de WhatsApp para mostrar actividad.
                  </Description>
                </Surface>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="activity">
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Actividad del flujo</h2>
                  <Description className="text-default-500 text-xs">
                    Eventos de correo Doctoralia ya parseados y guardados en la base de datos.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  {statsPending ? (
                    <Skeleton className="h-44 w-full rounded-2xl" />
                  ) : stats ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <MetricPill
                          title="Total"
                          subtitle="eventos"
                          tone="primary"
                          value={stats.total}
                        />
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
                    </>
                  ) : (
                    <Alert status="danger">
                      <Alert.Content>
                        <Alert.Description>
                          No se pudo cargar la actividad del flujo.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}
                </Card.Content>
              </Card>

              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Intervención manual</h2>
                  <Description className="text-default-500 text-xs">
                    Ejecuta una lectura puntual del buzón además del listener IMAP continuo.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                  <Button
                    isDisabled={ingestMutation.isPending}
                    isPending={ingestMutation.isPending}
                    onPress={() => ingestMutation.mutate()}
                    variant="primary"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Ejecutar ingesta ahora
                  </Button>

                  <Description className="text-default-500 text-xs">
                    Relee el buzón, valida correos Doctoralia y guarda eventos en la base de datos,
                    sin depender de WhatsApp.
                  </Description>
                </Card.Content>
              </Card>
            </div>

            {notificationsPending ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : notificationsError ? (
              <Alert status="danger">
                <Alert.Content>
                  <Alert.Description>
                    {notificationsError instanceof Error
                      ? notificationsError.message
                      : "No se pudo cargar la tabla de eventos de Doctoralia."}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <DataTable
                columns={doctoraliaNotificationColumns}
                data={notifications as DoctoraliaEmailNotification[]}
                enableExport={false}
                enableGlobalFilter={false}
                onPaginationChange={setPagination}
                pageCount={pageCount}
                pagination={pagination}
                scrollMaxHeight="min(65dvh, 700px)"
              />
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="scraper">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <DoctoraliaCookieStorePanel />
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="flex items-center gap-2 font-semibold text-base">
                  <Cookie className="h-4 w-4" /> Bot de calendario
                </h2>
                <Description className="text-default-500 text-xs">
                  Cómo funcionan las cookies pegadas aquí.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3 text-default-600 text-sm">
                <p>
                  El scraper corre en Railway cada 30 minutos, se autentica a Doctoralia con las
                  cookies pegadas y extrae el calendario directo a nuestra base de datos.
                </p>
                <p>
                  Cuando las cookies expiran (≈2–4 semanas), vuelve a DevTools → Network → copia el
                  header Cookie y pégalo a la izquierda.
                </p>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
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

function formatStatusDate(value: Date | null | undefined) {
  return value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "Sin registro";
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

const doctoraliaNotificationColumns: ColumnDef<DoctoraliaEmailNotification>[] = [
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
        ? dayjs(row.original.appointmentDate).format("DD/MM/YYYY HH:mm")
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
