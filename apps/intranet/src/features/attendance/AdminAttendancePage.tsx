import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  TextField,
  Tooltip,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Suspense, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { formatChile, startOfMonth, today } from "@/lib/dates";
import { AppDateRangePicker, AppDateTimePicker } from "@/components/forms/AppDatePicker";
import { AppModal } from "@/components/ui/AppModal";
import type {
  attendanceMarkSchema,
  attendanceMarkTypeSchema,
  officeNetworkSchema,
} from "@finanzas/orpc-contracts/attendance";
import type { z } from "zod";
import { attendanceORPCClient, toAttendanceApiError } from "./orpc";
import { getAttendanceNetworkOrigin } from "./network-origin";
import { attendanceQueries } from "./queries";

type AttendanceMark = z.infer<typeof attendanceMarkSchema> & {
  employeeName?: string;
  employeeRut?: string;
  isDayIncomplete: boolean;
};
type MarkType = z.infer<typeof attendanceMarkTypeSchema>;
type OfficeNetwork = z.infer<typeof officeNetworkSchema>;
type CompletionFilter = "all" | "complete" | "incomplete";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Corrección manual modal ───────────────────────────────────────────────────

interface AdminMarkModalProps {
  onClose: () => void;
}

function AdminMarkModal({ onClose }: AdminMarkModalProps) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<MarkType>("CLOCK_IN");
  const [markedAt, setMarkedAt] = useState(formatChile(new Date(), "YYYY-MM-DDTHH:mm"));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      attendanceORPCClient.adminMark({
        employeeId: Number(employeeId),
        markedAt: new Date(markedAt).toISOString(),
        notes: notes || undefined,
        type,
      }),
    onError: (err) => {
      setError(toAttendanceApiError(err).message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", "list"] });
      onClose();
    },
  });

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title="Corrección manual"
      size="md"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            isDisabled={!employeeId || mutation.isPending}
            variant="primary"
            onPress={() => mutation.mutate()}
          >
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField value={employeeId} onChange={setEmployeeId}>
          <Label>ID Empleado</Label>
          <Input inputMode="numeric" placeholder="Ej: 1" />
        </TextField>

        <Select
          value={type}
          onChange={(key) => {
            if (key) setType(key as MarkType);
          }}
        >
          <Label>Tipo</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="CLOCK_IN">Entrada</ListBox.Item>
              <ListBox.Item id="CLOCK_OUT">Salida</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <AppDateTimePicker label="Fecha y hora" value={markedAt} onChange={setMarkedAt} />

        <TextField value={notes} onChange={setNotes}>
          <Label>Notas (opcional)</Label>
          <Input placeholder="Motivo de la corrección..." />
        </TextField>

        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>
    </AppModal>
  );
}

// ── Tabla de marcas ───────────────────────────────────────────────────────────

interface MarksTableProps {
  isDeletingId: number | null;
  marks: AttendanceMark[];
  onDelete: (id: number) => void;
  summary: { totalMarks: number; incompleteDays: number; totalWorkedMinutes: number };
}

function MarksTable({ isDeletingId, marks, onDelete, summary }: MarksTableProps) {
  const columns = useMemo<ColumnDef<AttendanceMark>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Empleado",
        cell: ({ row }) => {
          const mark = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">{mark.employeeName ?? `ID ${mark.employeeId}`}</p>
              {mark.employeeRut && (
                <p className="text-xs text-foreground-400">{mark.employeeRut}</p>
              )}
              {mark.isDayIncomplete && (
                <Chip color="warning" size="sm" variant="soft">
                  Día incompleto
                </Chip>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => (
          <Chip
            color={row.original.type === "CLOCK_IN" ? "success" : "danger"}
            size="sm"
            variant="soft"
          >
            {row.original.type === "CLOCK_IN" ? "Entrada" : "Salida"}
          </Chip>
        ),
      },
      {
        accessorKey: "markedAt",
        header: "Hora (Santiago)",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatChile(row.original.markedAt, "DD/MM/YYYY HH:mm")}
          </span>
        ),
      },
      {
        id: "network",
        header: "Red",
        cell: ({ row }) => {
          const networkOrigin = getAttendanceNetworkOrigin(row.original);
          return (
            <Chip color={networkOrigin.tone} size="sm" variant="secondary">
              {networkOrigin.label}
            </Chip>
          );
        },
      },
      {
        accessorKey: "connectionType",
        header: "Conexión",
        cell: ({ row }) =>
          row.original.connectionType ? (
            <Chip size="sm" variant="secondary">
              {row.original.connectionType}
            </Chip>
          ) : (
            <span className="text-foreground-300">—</span>
          ),
      },
      {
        id: "gps",
        header: "GPS",
        cell: ({ row }) => {
          const mark = row.original;
          return mark.latitude !== null && mark.longitude !== null ? (
            <a
              className="text-accent hover:underline"
              href={`https://www.google.com/maps?q=${mark.latitude},${mark.longitude}`}
              rel="noopener noreferrer"
              target="_blank"
              title={`Precisión: ${mark.accuracyMeters?.toFixed(0) ?? "?"}m`}
            >
              Ver mapa
            </a>
          ) : (
            <span className="text-foreground-300">—</span>
          );
        },
      },
      {
        id: "device",
        header: "Dispositivo",
        cell: ({ row }) => {
          const mark = row.original;
          return mark.isMobile !== null || mark.screenResolution ? (
            <Tooltip>
              <Tooltip.Trigger aria-label="Dispositivo de marca">
                <div className="flex items-center gap-1.5">
                  <Chip size="sm" variant="secondary">
                    {mark.isMobile ? "Móvil" : "Desktop"}
                  </Chip>
                  {mark.screenResolution && (
                    <span className="text-xs text-foreground-400">{mark.screenResolution}</span>
                  )}
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <div className="flex flex-col gap-0.5 text-xs">
                  {mark.clientTimezone && <span>TZ: {mark.clientTimezone}</span>}
                  {mark.cpuCores != null && <span>CPU: {mark.cpuCores} núcleos</span>}
                  {mark.deviceRam != null && <span>RAM: {mark.deviceRam} GB</span>}
                  {mark.devicePixelRatio != null && <span>DPR: {mark.devicePixelRatio}x</span>}
                  {mark.downlinkMbps != null && <span>Bajada: {mark.downlinkMbps} Mbps</span>}
                </div>
              </Tooltip.Content>
            </Tooltip>
          ) : (
            <span className="text-foreground-300">—</span>
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notas",
        cell: ({ row }) => <span className="text-foreground-500">{row.original.notes ?? "—"}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            isDisabled={isDeletingId === row.original.id}
            variant="danger-soft"
            onPress={() => onDelete(row.original.id)}
          >
            {isDeletingId === row.original.id ? "..." : "Eliminar"}
          </Button>
        ),
      },
    ],
    [isDeletingId, onDelete]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-default-100 bg-default-50 px-4 py-3 text-sm">
        <span className="text-foreground-500">
          <span className="font-semibold text-foreground">{summary.totalMarks}</span> registros
        </span>
        {summary.incompleteDays > 0 && (
          <span className="text-warning">
            <span className="font-semibold">{summary.incompleteDays}</span> días incompletos
          </span>
        )}
        {summary.totalWorkedMinutes > 0 && (
          <span className="text-foreground-500">
            Total:{" "}
            <span className="font-semibold text-foreground">
              {formatMinutes(summary.totalWorkedMinutes)}
            </span>
          </span>
        )}
      </div>

      <DataTable
        enableToolbar={false}
        columns={columns}
        data={marks}
        enableExport={false}
        enableGlobalFilter={false}
        noDataMessage="No hay registros para el período seleccionado."
      />
    </div>
  );
}

interface OfficeNetworkModalProps {
  initialValue?: OfficeNetwork | null;
  onClose: () => void;
}

function OfficeNetworkModal({ initialValue, onClose }: OfficeNetworkModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialValue?.name ?? "");
  const [cidr, setCidr] = useState(initialValue?.cidr ?? "");
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(initialValue);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (isEditing && initialValue) {
        return attendanceORPCClient.updateOfficeNetwork({
          cidr,
          id: initialValue.id,
          name,
        });
      }
      return attendanceORPCClient.createOfficeNetwork({ cidr, name });
    },
    onError: (err) => {
      setError(toAttendanceApiError(err).message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", "office-networks"] });
      onClose();
    },
  });

  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={isEditing ? "Editar red de oficina" : "Agregar red de oficina"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            isDisabled={!name.trim() || !cidr.trim() || mutation.isPending}
            variant="primary"
            onPress={() => mutation.mutate()}
          >
            {mutation.isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField value={name} onChange={setName}>
          <Label>Nombre</Label>
          <Input placeholder="Casa matriz, sucursal, VPN..." />
        </TextField>

        <TextField value={cidr} onChange={setCidr}>
          <Label>CIDR o IP</Label>
          <Input placeholder="Ej: 200.10.20.0/24 o 200.10.20.15" />
        </TextField>

        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>
    </AppModal>
  );
}

function OfficeNetworksCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(attendanceQueries.officeNetworks());
  const [editingNetwork, setEditingNetwork] = useState<OfficeNetwork | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const networks = data?.networks ?? [];

  const toggleMutation = useMutation({
    mutationFn: async (network: OfficeNetwork) =>
      attendanceORPCClient.updateOfficeNetwork({
        id: network.id,
        isActive: !network.isActive,
      }),
    onMutate: (network) => setBusyId(network.id),
    onSettled: () => setBusyId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", "office-networks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => attendanceORPCClient.deleteOfficeNetwork({ id }),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", "office-networks"] });
    },
  });

  return (
    <>
      <Card className="rounded-3xl shadow-sm" variant="default">
        <Card.Header className="flex flex-col gap-3 p-5 pb-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <Card.Title className="text-base">Redes de oficina</Card.Title>
            <Card.Description className="max-w-2xl text-sm leading-6">
              Aqui se define que IP o rango CIDR se considera interno para el marcaje. Todo lo que
              no haga match cae como red externa; las correcciones admin quedan aparte.
            </Card.Description>
          </div>
          <Button variant="primary" onPress={() => setShowCreateModal(true)}>
            Agregar red
          </Button>
        </Card.Header>

        <Card.Content className="flex flex-col gap-3 p-5 pt-0">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : networks.length === 0 ? (
            <Alert status="default">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  No hay redes registradas. Todas las marcas quedaran como externas hasta agregar
                  una.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            networks.map((network) => (
              <div
                key={network.id}
                className="flex flex-col gap-3 rounded-2xl border border-default-200 md:flex-row md:items-center md:justify-between p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{network.name}</p>
                    <Chip color={network.isActive ? "success" : "default"} size="sm" variant="soft">
                      {network.isActive ? "Activa" : "Inactiva"}
                    </Chip>
                  </div>
                  <p className="font-mono text-sm text-foreground-500">{network.cidr}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    isDisabled={busyId === network.id}
                    variant="secondary"
                    onPress={() => setEditingNetwork(network)}
                  >
                    Editar
                  </Button>
                  <Button
                    isDisabled={busyId === network.id}
                    variant="secondary"
                    onPress={() => toggleMutation.mutate(network)}
                  >
                    {network.isActive ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    isDisabled={busyId === network.id}
                    variant="danger-soft"
                    onPress={() => deleteMutation.mutate(network.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card.Content>
      </Card>

      {showCreateModal && <OfficeNetworkModal onClose={() => setShowCreateModal(false)} />}
      {editingNetwork && (
        <OfficeNetworkModal initialValue={editingNetwork} onClose={() => setEditingNetwork(null)} />
      )}
    </>
  );
}

// ── Contenido principal ───────────────────────────────────────────────────────

function AdminAttendanceContent() {
  const queryClient = useQueryClient();
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState(startOfMonth());
  const [toFilter, setToFilter] = useState(today());
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const params = {
    completionStatus: completionFilter === "all" ? undefined : completionFilter,
    employeeId: employeeIdFilter ? Number(employeeIdFilter) : undefined,
    from: fromFilter || undefined,
    to: toFilter || undefined,
  };

  const { data, isLoading } = useQuery(attendanceQueries.list(params));
  const marks = (data?.marks ?? []) as AttendanceMark[];
  const summary = data?.summary ?? { totalMarks: 0, incompleteDays: 0, totalWorkedMinutes: 0 };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => attendanceORPCClient.deleteMark({ id }),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", "list"] });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <OfficeNetworksCard />

      <div className="flex flex-wrap items-end gap-3">
        <TextField className="w-40" value={employeeIdFilter} onChange={setEmployeeIdFilter}>
          <Label>ID Empleado</Label>
          <Input inputMode="numeric" placeholder="Todos" />
        </TextField>

        <AppDateRangePicker
          className="w-72"
          label="Rango de fechas"
          startValue={fromFilter}
          endValue={toFilter}
          visibleMonths={2}
          onChange={(from, to) => {
            setFromFilter(from);
            setToFilter(to);
          }}
        />

        <Select
          className="w-44"
          value={completionFilter}
          onChange={(key) => {
            if (key) setCompletionFilter(key as CompletionFilter);
          }}
        >
          <Label>Estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="all">Todos</ListBox.Item>
              <ListBox.Item id="complete">Completos</ListBox.Item>
              <ListBox.Item id="incomplete">Incompletos</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="ml-auto">
          <Button variant="primary" onPress={() => setShowModal(true)}>
            Corrección manual
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : (
        <MarksTable
          isDeletingId={deletingId}
          marks={marks}
          onDelete={(id) => deleteMutation.mutate(id)}
          summary={summary}
        />
      )}

      {showModal && <AdminMarkModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export function AdminAttendancePage() {
  return (
    <div className="p-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        }
      >
        <AdminAttendanceContent />
      </Suspense>
    </div>
  );
}
