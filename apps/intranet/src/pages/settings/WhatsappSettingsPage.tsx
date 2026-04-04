import type React from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Link,
  ProgressBar,
  Separator,
  Skeleton,
  Surface,
  Tabs,
  TextField,
} from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Clock3,
  Mail,
  MessageCircleReply,
  RefreshCw,
  Send,
  ShieldCheck,
  SquareArrowOutUpRight,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { MetricCard } from "@/features/calendar/components/MetricCard";
import { sendWhatsappTest, triggerWhatsappPoll } from "@/features/whatsapp/api";
import { whatsappKeys } from "@/features/whatsapp/queries";
import { PAGE_CONTAINER } from "@/lib/styles";

type WaNotification = {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: Date | null | undefined;
  appointmentService: string | null | undefined;
  status: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ";
  sentAt: Date | null | undefined;
  deliveredAt: Date | null | undefined;
  readAt: Date | null | undefined;
  errorMessage: string | null | undefined;
  createdAt: Date;
};

const STATUS_LABELS: Record<WaNotification["status"], string> = {
  DELIVERED: "Entregado",
  FAILED: "Fallido",
  PENDING: "Pendiente",
  READ: "Leído",
  SENT: "Enviado",
};

const STATUS_COLORS: Record<WaNotification["status"], React.ComponentProps<typeof Chip>["color"]> =
  {
    DELIVERED: "accent",
    FAILED: "danger",
    PENDING: "warning",
    READ: "success",
    SENT: "default",
  };

function StatusBadge({ status }: { status: WaNotification["status"] }) {
  return (
    <Chip color={STATUS_COLORS[status]} size="sm" variant="soft">
      {STATUS_LABELS[status]}
    </Chip>
  );
}

function ReadyChip({
  falseLabel = "Pendiente",
  trueLabel = "Listo",
  value,
}: {
  falseLabel?: string;
  trueLabel?: string;
  value: boolean;
}) {
  return (
    <Chip color={value ? "success" : "warning"} size="sm" variant="soft">
      {value ? trueLabel : falseLabel}
    </Chip>
  );
}

function ChecklistRow({
  description,
  icon: Icon,
  ready,
  title,
}: {
  description: string;
  icon: LucideIcon;
  ready: boolean;
  title: string;
}) {
  return (
    <Surface className="flex items-start justify-between gap-3 rounded-2xl border border-default-200 px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
            ready ? "bg-success/12 text-success" : "bg-warning/12 text-warning"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <Description className="text-default-500 text-xs">{description}</Description>
        </div>
      </div>
      <ReadyChip value={ready} />
    </Surface>
  );
}

function FlowStep({
  body,
  icon: Icon,
  step,
  title,
}: {
  body: string;
  icon: LucideIcon;
  step: string;
  title: string;
}) {
  return (
    <Surface className="rounded-2xl border border-default-200 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
            {step}
          </Description>
          <p className="font-medium text-sm">{title}</p>
          <Description className="mt-1 text-default-500 text-xs">{body}</Description>
        </div>
      </div>
    </Surface>
  );
}

const columns: ColumnDef<WaNotification>[] = [
  {
    accessorKey: "patientName",
    cell: ({ row }) => <span className="font-medium">{row.original.patientName}</span>,
    header: "Paciente",
  },
  {
    accessorKey: "patientPhone",
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
      <span className="max-w-50 truncate text-sm">{row.original.appointmentService ?? "—"}</span>
    ),
    header: "Servicio",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    header: "Estado",
  },
  {
    accessorKey: "sentAt",
    cell: ({ row }) =>
      row.original.sentAt ? dayjs(row.original.sentAt).format("DD/MM HH:mm") : "—",
    header: "Enviado",
  },
  {
    accessorKey: "deliveredAt",
    cell: ({ row }) =>
      row.original.deliveredAt ? dayjs(row.original.deliveredAt).format("DD/MM HH:mm") : "—",
    header: "Entregado",
  },
  {
    accessorKey: "readAt",
    cell: ({ row }) =>
      row.original.readAt ? dayjs(row.original.readAt).format("DD/MM HH:mm") : "—",
    header: "Leído",
  },
  {
    accessorKey: "createdAt",
    cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM HH:mm"),
    header: "Registrado",
  },
];

export function WhatsappSettingsPage() {
  const { error: showError, success: showSuccess } = useToast();
  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [testPhone, setTestPhone] = useState("");

  const limit = pagination.pageSize;
  const offset = pagination.pageIndex * pagination.pageSize;

  const { data: notificationsData, isPending: notificationsPending } = useQuery({
    ...whatsappKeys.notifications({ limit, offset }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasPending = data.notifications.some((n) => n.status === "PENDING");
      return hasPending ? 15_000 : false;
    },
  });

  const { data: stats, isPending: statsPending } = useQuery({
    ...whatsappKeys.stats(),
    refetchInterval: 30_000,
  });

  const { data: overview, isPending: overviewPending } = useQuery({
    ...whatsappKeys.overview(),
    refetchInterval: 30_000,
  });

  const pollMutation = useMutation({
    mutationFn: triggerWhatsappPoll,
    onError: (err: Error) => showError(`Error al disparar poll: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(result.message, "Poll completado");
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.all });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => sendWhatsappTest(testPhone),
    onError: (err: Error) => showError(`Error al enviar: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "ok") {
        showSuccess(result.message, "Mensaje enviado");
      } else {
        showError(result.message, "Error al enviar");
      }
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.overview().queryKey });
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
      overview.outboundReady,
      overview.webhookReady,
      overview.imapReady,
      overview.automaticNotificationsEnabled,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [overview]);

  const missingBlocks = useMemo(() => {
    if (!overview) return [];
    const items: string[] = [];
    if (!overview.outboundReady) items.push("credenciales de salida");
    if (!overview.webhookReady) items.push("webhook");
    if (!overview.imapReady) items.push("IMAP Doctoralia");
    if (!overview.automaticNotificationsEnabled) items.push("poll automático");
    return items;
  }, [overview]);

  const testModeLabel =
    testMutation.data?.mode === "text"
      ? "Texto libre"
      : testMutation.data?.mode === "template"
        ? "Template"
        : null;

  return (
    <div className={PAGE_CONTAINER}>
      <Surface className="rounded-[28px] border border-default-200 bg-gradient-to-br from-background via-default-50 to-success/5 p-6 shadow-inner">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip color={overview?.hybridFlowReady ? "success" : "warning"} variant="soft">
                {overview?.hybridFlowReady ? "Flujo híbrido activo" : "Flujo en configuración"}
              </Chip>
              <Chip color="default" variant="soft">
                Doctoralia → WhatsApp
              </Chip>
              <Chip color="accent" variant="soft">
                Ventanas activas: {overview?.activeCustomerServiceWindows ?? 0}
              </Chip>
            </div>
            <div>
              <h1 className="font-semibold text-2xl">WhatsApp</h1>
              <Description className="max-w-3xl text-default-600 text-sm">
                El módulo revisa correos de Doctoralia, decide si corresponde enviar template o
                texto libre según la ventana de 24 horas, y registra estados de entrega vía webhook.
              </Description>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              size="sm"
              subtitle="listos para recibir"
              title="Webhook"
              tone={overview?.webhookReady ? "success" : "warning"}
              value={overview?.webhookReady ? "OK" : "Pend."}
            />
            <MetricCard
              size="sm"
              subtitle="token + phone ID"
              title="Salida"
              tone={overview?.outboundReady ? "success" : "warning"}
              value={overview?.outboundReady ? "OK" : "Pend."}
            />
            <MetricCard
              size="sm"
              subtitle="host, user y pass"
              title="IMAP"
              tone={overview?.imapReady ? "success" : "warning"}
              value={overview?.imapReady ? "OK" : "Pend."}
            />
            <MetricCard
              size="sm"
              subtitle="poll habilitado"
              title="Auto"
              tone={overview?.automaticNotificationsEnabled ? "success" : "warning"}
              value={overview?.automaticNotificationsEnabled ? "ON" : "OFF"}
            />
          </div>
        </div>
      </Surface>

      <Tabs defaultSelectedKey="notifications" className="mt-6">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones de WhatsApp">
            <Tabs.Tab id="notifications">
              Notificaciones
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="config">
              Configuración
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="notifications">
          <div className="mt-4 space-y-4">
            {!overviewPending && overview && !overview.hybridFlowReady ? (
              <Alert status="warning">
                El flujo híbrido aún no está completo. Falta: {missingBlocks.join(", ")}.
              </Alert>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Resumen de actividad</h2>
                  <Description className="text-default-500 text-xs">
                    Entregabilidad, lectura y ventanas activas para texto libre.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  {statsPending || overviewPending ? (
                    <Skeleton className="h-44 w-full rounded-2xl" />
                  ) : stats && overview ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <MetricCard title="Total" value={stats.total} />
                        <MetricCard title="Enviados" tone="primary" value={stats.sent} />
                        <MetricCard title="Entregados" tone="success" value={stats.delivered} />
                        <MetricCard title="Leídos" tone="success" value={stats.read} />
                        <MetricCard title="Fallidos" tone="error" value={stats.failed} />
                        <MetricCard
                          subtitle="números con 24h abiertas"
                          title="Ventanas activas"
                          tone="warning"
                          value={overview.activeCustomerServiceWindows}
                        />
                      </div>

                      <Separator />

                      <div className="grid gap-4 md:grid-cols-3">
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

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Description className="font-medium text-default-600 text-xs uppercase tracking-wide">
                              Preparación operativa
                            </Description>
                            <span className="font-semibold text-sm">{readiness}%</span>
                          </div>
                          <ProgressBar aria-label="Preparación operativa" value={readiness}>
                            <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                              <ProgressBar.Fill className="bg-primary" />
                            </ProgressBar.Track>
                          </ProgressBar>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Alert status="danger">No se pudo cargar el resumen de WhatsApp.</Alert>
                  )}
                </Card.Content>
              </Card>

              <Card>
                <Card.Header className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-base">Flujo actual</h2>
                    <Description className="text-default-500 text-xs">
                      Cómo decide el sistema qué tipo de mensaje enviar.
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
                    body="El poll IMAP revisa correos nuevos del remitente configurado y extrae la reserva."
                    icon={Mail}
                    step="01"
                    title="Doctoralia entra por IMAP"
                  />
                  <FlowStep
                    body="Si el paciente no respondió por WhatsApp en las últimas 24 horas, se usa el template configurado."
                    icon={Send}
                    step="02"
                    title="Primer contacto por template"
                  />
                  <FlowStep
                    body="Cuando el paciente responde y entra un webhook de tipo messages, se abre una ventana de texto libre."
                    icon={Webhook}
                    step="03"
                    title="Webhook abre la ventana de 24h"
                  />
                  <FlowStep
                    body="Mientras la ventana esté activa, el sistema reemplaza el template por texto libre."
                    icon={MessageCircleReply}
                    step="04"
                    title="Mensajes posteriores salen como texto"
                  />
                </Card.Content>
              </Card>
            </div>

            {notificationsPending ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <DataTable
                columns={columns}
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

        <Tabs.Panel id="config">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Estado operativo</h2>
                <Description className="text-default-500 text-xs">
                  Checklist real del módulo según la configuración activa del backend.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                {overviewPending ? (
                  <Skeleton className="h-88 w-full rounded-2xl" />
                ) : overview ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Description className="text-default-500 text-xs uppercase tracking-wide">
                          Preparación del módulo
                        </Description>
                        <span className="font-semibold text-sm">{readiness}%</span>
                      </div>
                      <ProgressBar aria-label="Preparación del módulo" value={readiness}>
                        <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                          <ProgressBar.Fill className="bg-primary" />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>

                    <ChecklistRow
                      description="Token permanente y Phone Number ID válidos para llamar a Graph."
                      icon={ShieldCheck}
                      ready={overview.outboundReady}
                      title="Salida a WhatsApp"
                    />
                    <ChecklistRow
                      description="Verify token y App Secret listos para recibir y validar webhooks."
                      icon={Webhook}
                      ready={overview.webhookReady}
                      title="Webhook firmado"
                    />
                    <ChecklistRow
                      description="Host, usuario y contraseña listos para leer correos de Doctoralia."
                      icon={Mail}
                      ready={overview.imapReady}
                      title="Conexión IMAP"
                    />
                    <ChecklistRow
                      description="El scheduler está habilitado para revisar el buzón automáticamente."
                      icon={Clock3}
                      ready={overview.automaticNotificationsEnabled}
                      title="Poll automático"
                    />

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                        <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                          Template por defecto
                        </Description>
                        <p className="mt-1 font-medium text-sm">{overview.templateName}</p>
                        <Description className="text-default-500 text-xs">
                          Idioma: {overview.templateLanguage}
                        </Description>
                      </Surface>
                      <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                        <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                          Mensaje libre personalizado
                        </Description>
                        <div className="mt-1">
                          <ReadyChip
                            falseLabel="Usando texto por defecto"
                            trueLabel="Personalizado"
                            value={overview.freeformMessageConfigured}
                          />
                        </div>
                        <Description className="mt-2 text-default-500 text-xs">
                          Se usa sólo cuando existe una ventana activa de 24 horas.
                        </Description>
                      </Surface>
                      <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                        <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                          Poll cron
                        </Description>
                        <p className="mt-1 font-medium font-mono text-sm">{overview.pollCron}</p>
                        <Description className="text-default-500 text-xs">
                          Mailbox: {overview.imapMailbox}
                        </Description>
                      </Surface>
                      <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                        <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                          Filtro de remitente
                        </Description>
                        <p className="mt-1 font-medium text-sm">{overview.senderFilter}</p>
                        <Description className="text-default-500 text-xs">
                          Base del flujo de entrada por correo.
                        </Description>
                      </Surface>
                    </div>
                  </>
                ) : (
                  <Alert status="danger">No se pudo cargar el estado operativo.</Alert>
                )}
              </Card.Content>
            </Card>

            <div className="space-y-4">
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Enviar mensaje de prueba</h2>
                  <Description className="text-default-500 text-xs">
                    El backend decide al enviar: texto libre si el número tiene ventana activa; si
                    no, template.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  <TextField className="w-full" onChange={setTestPhone} value={testPhone}>
                    <Input placeholder="+56912345678" type="tel" />
                  </TextField>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      isDisabled={testMutation.isPending || !testPhone.trim()}
                      isPending={testMutation.isPending}
                      onPress={() => testMutation.mutate()}
                      size="sm"
                      variant="primary"
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </Button>
                    {testModeLabel ? (
                      <Chip
                        color={testMutation.data?.mode === "text" ? "accent" : "default"}
                        variant="soft"
                      >
                        {testModeLabel}
                      </Chip>
                    ) : null}
                  </div>

                  <Description className="text-default-500 text-xs">
                    Si el paciente ya respondió por WhatsApp en las últimas 24 horas, este envío
                    sale como texto. Si no, cae al template configurado.
                  </Description>

                  {testMutation.data ? (
                    <Alert status={testMutation.data.status === "ok" ? "success" : "danger"}>
                      {testMutation.data.message}
                    </Alert>
                  ) : null}
                </Card.Content>
              </Card>

              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Regla de 24 horas</h2>
                  <Description className="text-default-500 text-xs">
                    Esto es lo que el módulo hace para mantenerse dentro de las reglas de Meta.
                  </Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                  <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                    <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                      Sin respuesta del paciente
                    </Description>
                    <p className="mt-1 font-medium text-sm">Se envía template</p>
                    <Description className="text-default-500 text-xs">
                      El correo de Doctoralia por sí solo no abre una ventana de atención en
                      WhatsApp.
                    </Description>
                  </Surface>

                  <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                    <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                      Con respuesta del paciente
                    </Description>
                    <p className="mt-1 font-medium text-sm">Se habilita texto libre por 24h</p>
                    <Description className="text-default-500 text-xs">
                      El webhook guarda el último inbound por teléfono y calcula el vencimiento de
                      la ventana.
                    </Description>
                  </Surface>

                  <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                    <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                      Documentación oficial
                    </Description>
                    <Link
                      className="mt-1 inline-flex items-center gap-1 font-medium text-primary text-sm"
                      href="https://developers.facebook.com/docs/whatsapp/cloud-api/"
                      rel="noreferrer"
                      target="_blank"
                    >
                      WhatsApp Cloud API
                      <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Surface>
                </Card.Content>
              </Card>
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
