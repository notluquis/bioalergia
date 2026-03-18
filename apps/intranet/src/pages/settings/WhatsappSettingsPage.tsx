import type React from "react";
import { Alert, Button, Card, Chip, Input, Skeleton, Tabs, TextField } from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
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
    },
  });

  const notifications = notificationsData?.notifications ?? [];
  const pageCount = Math.ceil((notificationsData?.total ?? 0) / limit);

  return (
    <div className={PAGE_CONTAINER}>
      <Tabs>
        <Tabs.List>
          <Tabs.Tab id="notifications">Notificaciones</Tabs.Tab>
          <Tabs.Tab id="config">Configuración</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="notifications">
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mensajes enviados a pacientes tras reservar en Doctoralia.
              </p>
              <Button
                isDisabled={pollMutation.isPending}
                isPending={pollMutation.isPending}
                onPress={() => pollMutation.mutate()}
                size="sm"
                variant="secondary"
              >
                <RefreshCw className="h-4 w-4" />
                Revisar emails ahora
              </Button>
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
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Stats */}
            <Card>
              <Card.Header>
                <h2 className="text-base font-semibold">Estadísticas</h2>
              </Card.Header>
              <Card.Content>
                {statsPending ? (
                  <Skeleton className="h-32 w-full rounded" />
                ) : stats ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {(
                      [
                        ["Total", stats.total],
                        ["Enviados", stats.sent],
                        ["Entregados", stats.delivered],
                        ["Leídos", stats.read],
                        ["Fallidos", stats.failed],
                        ["Pendientes", stats.pending],
                      ] as [string, number][]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="text-lg font-bold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <Alert status="danger">No se pudieron cargar las estadísticas</Alert>
                )}
              </Card.Content>
            </Card>

            {/* Test send */}
            <Card>
              <Card.Header>
                <h2 className="text-base font-semibold">Enviar mensaje de prueba</h2>
              </Card.Header>
              <Card.Content className="space-y-3">
                <p className="text-sm text-gray-500">
                  Envía el template de WhatsApp configurado al número indicado.
                </p>
                <div className="flex gap-2">
                  <TextField className="flex-1" onChange={setTestPhone} value={testPhone}>
                    <Input placeholder="+56912345678" type="tel" />
                  </TextField>
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
                </div>
                {testMutation.data && (
                  <Alert status={testMutation.data.status === "ok" ? "success" : "danger"}>
                    {testMutation.data.message}
                  </Alert>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
