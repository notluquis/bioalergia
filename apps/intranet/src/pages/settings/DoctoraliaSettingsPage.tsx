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
import type { PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  Mail,
  MessageCircleReply,
  RefreshCw,
  Send,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { triggerDoctoraliaEmailPoll } from "@/features/doctoralia/settings-api";
import { doctoraliaSettingsKeys } from "@/features/doctoralia/settings-queries";
import { PAGE_CONTAINER } from "@/lib/styles";
import {
  ChecklistRow,
  FlowStep,
  type WaNotification,
  whatsappNotificationColumns,
} from "./messaging-settings-shared";

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

  const { data: notificationsData, isPending: notificationsPending } = useQuery({
    ...doctoraliaSettingsKeys.notifications({ limit, offset }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasPending = data.notifications.some((n) => n.status === "PENDING");
      return hasPending ? 15_000 : false;
    },
  });

  const pollMutation = useMutation({
    mutationFn: triggerDoctoraliaEmailPoll,
    onError: (err: Error) => showError(`Error al disparar poll: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "error") {
        showError(result.message, "Poll fallido");
        return;
      }

      showSuccess(result.message, "Poll completado");
      void queryClient.invalidateQueries({ queryKey: doctoraliaSettingsKeys.all });
    },
  });

  const notifications = notificationsData?.notifications ?? [];
  const pageCount = Math.ceil((notificationsData?.total ?? 0) / limit);

  const deliveryRate = useMemo(() => {
    if (!stats?.sent) return 0;
    return Math.round((stats.delivered / stats.sent) * 100);
  }, [stats]);

  const readRate = useMemo(() => {
    if (!stats?.delivered) return 0;
    return Math.round((stats.read / stats.delivered) * 100);
  }, [stats]);

  const readiness = useMemo(() => {
    if (!overview) return 0;
    const checks = [
      overview.imapHostConfigured,
      overview.imapUserConfigured,
      overview.imapPassConfigured,
      overview.automaticNotificationsEnabled,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [overview]);

  const missingBlocks = useMemo(() => {
    if (!overview) return [];
    const items: string[] = [];
    if (!overview.imapHostConfigured) items.push("host IMAP");
    if (!overview.imapUserConfigured) items.push("usuario IMAP");
    if (!overview.imapPassConfigured) items.push("password IMAP");
    if (!overview.automaticNotificationsEnabled) items.push("poll automático");
    return items;
  }, [overview]);

  const listenerSummary = useMemo(() => {
    const listener = overview?.doctoraliaImapListener;
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
      <Surface className="rounded-[28px] border border-default-200 bg-linear-to-br from-background via-default-50 to-warning/5 p-6 shadow-inner">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={overview?.imapReady ? "IMAP listo" : "IMAP pendiente"}
                tone={overview?.imapReady ? "success" : "warning"}
              />
              <StatusPill
                label={listenerSummary ? `Listener ${listenerSummary.label}` : "Listener pendiente"}
                tone={listenerSummary?.tone ?? "warning"}
              />
              <StatusPill
                label={
                  overview?.automaticNotificationsEnabled ? "Poll activo" : "Poll deshabilitado"
                }
                tone={overview?.automaticNotificationsEnabled ? "success" : "warning"}
              />
              <StatusPill
                label={overview?.connected ? "WhatsApp disponible" : "WhatsApp pendiente"}
                tone={overview?.connected ? "accent" : "warning"}
              />
            </div>

            <div>
              <h1 className="font-semibold text-2xl">Doctoralia</h1>
              <Description className="max-w-3xl text-default-600 text-sm">
                Flujo de notificaciones por correo: lectura IMAP, parseo de reservas, poll
                automático y despacho al canal de WhatsApp.
              </Description>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricPill
              subtitle="runtime"
              title="Listener"
              tone={listenerSummary?.tone ?? "warning"}
              value={listenerSummary?.label ?? "Pend."}
            />
            <MetricPill
              subtitle="scheduler"
              title="Poll"
              tone={overview?.automaticNotificationsEnabled ? "success" : "warning"}
              value={overview?.automaticNotificationsEnabled ? "ON" : "OFF"}
            />
            <MetricPill
              subtitle="entrega"
              title="Delivery"
              tone="accent"
              value={`${deliveryRate}%`}
            />
            <MetricPill subtitle="lectura" title="Read" tone="primary" value={`${readRate}%`} />
          </div>
        </div>
      </Surface>

      <Tabs className="mt-6" defaultSelectedKey="overview">
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
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="overview">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Estado de la ingesta</h2>
                <Description className="text-default-500 text-xs">
                  Esto cubre configuración, listener IMAP y dependencia del canal de salida.
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
                      description="Scheduler activo para revisar correos sin intervención manual."
                      icon={CalendarClock}
                      ready={overview.automaticNotificationsEnabled}
                      title="Poll automático"
                    />
                    <ChecklistRow
                      description={listenerSummary?.description ?? "Estado real del listener IMAP."}
                      icon={Activity}
                      ready={overview.doctoraliaImapListener.state === "connected"}
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
                  Valores activos que afectan cómo entra el correo y cuándo se dispara el envío.
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
                    Cron
                  </Description>
                  <p className="mt-1 font-medium font-mono text-sm">{overview?.pollCron ?? "—"}</p>
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
                    {formatStatusDate(overview?.doctoraliaImapListener.lastConnectedAt)}
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Último correo procesado
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {formatStatusDate(overview?.doctoraliaImapListener.lastProcessedAt)}
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Dependencia de salida
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {overview?.connected ? "WhatsApp disponible" : "WhatsApp no listo"}
                  </p>
                  <Description className="text-default-500 text-xs">
                    Doctoralia puede leer y parsear correos, pero el despacho final depende del
                    canal de WhatsApp.
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
                    Este pipeline es distinto del canal; aquí se decide cuándo disparar el envío.
                  </Description>
                </div>
                <Button
                  isDisabled={pollMutation.isPending}
                  isPending={pollMutation.isPending}
                  onPress={() => pollMutation.mutate()}
                  size="sm"
                  variant="secondary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Revisar emails
                </Button>
              </Card.Header>
              <Card.Content className="space-y-3">
                <FlowStep
                  body="El scheduler revisa correos no leídos del buzón configurado usando IMAP."
                  icon={Mail}
                  step="01"
                  title="Lectura del buzón"
                />
                <FlowStep
                  body="Se extraen nombre, teléfono, fecha y servicio desde el correo de Doctoralia."
                  icon={Workflow}
                  step="02"
                  title="Parseo de la reserva"
                />
                <FlowStep
                  body="Si el paciente no tiene ventana activa de 24h, el módulo usa template; si la tiene, usa texto libre."
                  icon={MessageCircleReply}
                  step="03"
                  title="Decisión del tipo de mensaje"
                />
                <FlowStep
                  body="Se registra el resultado para trazabilidad y el webhook posterior actualiza entregado/leído/fallido."
                  icon={Send}
                  step="04"
                  title="Registro y seguimiento"
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
                    La ingesta aún no está completa. Falta: {missingBlocks.join(", ")}.
                  </Alert>
                ) : null}

                {!overviewPending && overview?.doctoraliaImapListener.lastErrorMessage ? (
                  <Alert status="warning">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">Último error IMAP</p>
                        <Description className="text-xs">
                          {overview.doctoraliaImapListener.lastErrorMessage}
                        </Description>
                        <Description className="text-default-500 text-xs">
                          {formatStatusDate(overview.doctoraliaImapListener.lastErrorAt)}
                        </Description>
                      </div>
                    </div>
                  </Alert>
                ) : null}

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Responsabilidad de Doctoralia
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Detectar y transformar el correo en un evento usable
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Responsabilidad de WhatsApp
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Enviar, recibir webhook y mantener la ventana de atención
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Métrica operativa
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {stats?.total ?? 0} notificaciones registradas
                  </p>
                  <Description className="text-default-500 text-xs">
                    Esta tabla refleja el flujo disparado desde correos de Doctoralia.
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
                    Entrega y lectura de los mensajes disparados desde notificaciones por correo.
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
                          subtitle="registrados"
                          tone="primary"
                          value={stats.total}
                        />
                        <MetricPill
                          title="Enviados"
                          subtitle="aceptados"
                          tone="success"
                          value={stats.sent}
                        />
                        <MetricPill
                          title="Entregados"
                          subtitle="delivery"
                          tone="accent"
                          value={stats.delivered}
                        />
                        <MetricPill
                          title="Leídos"
                          subtitle="read"
                          tone="success"
                          value={stats.read}
                        />
                        <MetricPill
                          title="Fallidos"
                          subtitle="errores"
                          tone="warning"
                          value={stats.failed}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Description className="font-medium text-default-600 text-xs uppercase tracking-wide">
                              Entrega sobre enviados
                            </Description>
                            <span className="font-semibold text-sm">{deliveryRate}%</span>
                          </div>
                          <ProgressBar aria-label="Entrega sobre enviados" value={deliveryRate}>
                            <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                              <ProgressBar.Fill className="bg-success" />
                            </ProgressBar.Track>
                          </ProgressBar>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Description className="font-medium text-default-600 text-xs uppercase tracking-wide">
                              Lectura sobre entregados
                            </Description>
                            <span className="font-semibold text-sm">{readRate}%</span>
                          </div>
                          <ProgressBar aria-label="Lectura sobre entregados" value={readRate}>
                            <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                              <ProgressBar.Fill className="bg-accent" />
                            </ProgressBar.Track>
                          </ProgressBar>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Alert status="danger">No se pudo cargar la actividad del flujo.</Alert>
                  )}
                </Card.Content>
              </Card>

              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Intervención manual</h2>
                  <Description className="text-default-500 text-xs">
                    Fuerza una revisión del buzón sin esperar al próximo cron.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                  <Button
                    isDisabled={pollMutation.isPending}
                    isPending={pollMutation.isPending}
                    onPress={() => pollMutation.mutate()}
                    variant="primary"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Ejecutar poll ahora
                  </Button>

                  <Description className="text-default-500 text-xs">
                    Útil para validar el parseo o forzar el pipeline después de una prueba de
                    correo.
                  </Description>
                </Card.Content>
              </Card>
            </div>

            {notificationsPending ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <DataTable
                columns={whatsappNotificationColumns}
                data={notifications as WaNotification[]}
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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "default" | "success" | "warning";
}) {
  return (
    <Chip color={tone} variant="soft">
      {label}
    </Chip>
  );
}

function formatStatusDate(value: Date | null | undefined) {
  return value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "Sin registro";
}
