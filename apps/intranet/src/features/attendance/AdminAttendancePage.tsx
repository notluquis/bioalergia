import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Table,
  TextField,
  Tooltip,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Suspense, useState } from "react";
import type {
  attendanceMarkSchema,
  attendanceMarkTypeSchema,
  officeNetworkSchema,
} from "@finanzas/orpc-contracts/attendance";
import type { z } from "zod";
import { attendanceORPCClient, toAttendanceApiError } from "./orpc";
import { getAttendanceNetworkOrigin } from "./network-origin";
import { attendanceQueries } from "./queries";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

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
  const [markedAt, setMarkedAt] = useState(dayjs().tz(TIMEZONE).format("YYYY-MM-DDTHH:mm"));
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
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="w-full max-w-md">
            <Modal.Header>
              <Modal.Heading>Corrección manual</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <TextField type="number" value={employeeId} onChange={setEmployeeId}>
                <Label>ID Empleado</Label>
                <Input placeholder="Ej: 1" />
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

              <TextField type="datetime-local" value={markedAt} onChange={setMarkedAt}>
                <Label>Fecha y hora</Label>
                <Input />
              </TextField>

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
            </Modal.Body>

            <div className="flex justify-end gap-2 p-6 pt-0">
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
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
  if (marks.length === 0) {
    return (
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>No hay registros para el período seleccionado.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

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

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Registros de asistencia">
            <Table.Header>
              <Table.Column isRowHeader>Empleado</Table.Column>
              <Table.Column>Tipo</Table.Column>
              <Table.Column>Hora (Santiago)</Table.Column>
              <Table.Column>Red</Table.Column>
              <Table.Column>Conexión</Table.Column>
              <Table.Column>GPS</Table.Column>
              <Table.Column>Dispositivo</Table.Column>
              <Table.Column>Notas</Table.Column>
              <Table.Column>{""}</Table.Column>
            </Table.Header>
            <Table.Body items={marks}>
              {(mark) => {
                const networkOrigin = getAttendanceNetworkOrigin(mark);
                return (
                  <Table.Row id={String(mark.id)}>
                    <Table.Cell>
                      <div className="flex flex-col gap-0.5">
                        <p className="font-medium">
                          {mark.employeeName ?? `ID ${mark.employeeId}`}
                        </p>
                        {mark.employeeRut && (
                          <p className="text-xs text-foreground-400">{mark.employeeRut}</p>
                        )}
                        {mark.isDayIncomplete && (
                          <Chip color="warning" size="sm" variant="soft">
                            Día incompleto
                          </Chip>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={mark.type === "CLOCK_IN" ? "success" : "danger"}
                        size="sm"
                        variant="soft"
                      >
                        {mark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="font-medium tabular-nums">
                      {dayjs(mark.markedAt).tz(TIMEZONE).format("DD/MM/YYYY HH:mm")}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip color={networkOrigin.tone} size="sm" variant="secondary">
                        {networkOrigin.label}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      {mark.connectionType ? (
                        <Chip size="sm" variant="secondary">
                          {mark.connectionType}
                        </Chip>
                      ) : (
                        <span className="text-foreground-300">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {mark.latitude !== null && mark.longitude !== null ? (
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
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {mark.isMobile !== null || mark.screenResolution ? (
                        <Tooltip>
                          <Tooltip.Trigger>
                            <div className="flex items-center gap-1.5">
                              <Chip size="sm" variant="secondary">
                                {mark.isMobile ? "Móvil" : "Desktop"}
                              </Chip>
                              {mark.screenResolution && (
                                <span className="text-xs text-foreground-400">
                                  {mark.screenResolution}
                                </span>
                              )}
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Content>
                            <div className="flex flex-col gap-0.5 text-xs">
                              {mark.clientTimezone && <span>TZ: {mark.clientTimezone}</span>}
                              {mark.cpuCores != null && <span>CPU: {mark.cpuCores} núcleos</span>}
                              {mark.deviceRam != null && <span>RAM: {mark.deviceRam} GB</span>}
                              {mark.devicePixelRatio != null && (
                                <span>DPR: {mark.devicePixelRatio}x</span>
                              )}
                              {mark.downlinkMbps != null && (
                                <span>Bajada: {mark.downlinkMbps} Mbps</span>
                              )}
                            </div>
                          </Tooltip.Content>
                        </Tooltip>
                      ) : (
                        <span className="text-foreground-300">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-foreground-500">{mark.notes ?? "—"}</Table.Cell>
                    <Table.Cell>
                      <Button
                        isDisabled={isDeletingId === mark.id}
                        variant="danger-soft"
                        onPress={() => onDelete(mark.id)}
                      >
                        {isDeletingId === mark.id ? "..." : "Eliminar"}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
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
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="w-full max-w-md">
            <Modal.Header>
              <Modal.Heading>
                {isEditing ? "Editar red de oficina" : "Agregar red de oficina"}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
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
            </Modal.Body>

            <div className="flex justify-end gap-2 p-6 pt-0">
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
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
                className="flex flex-col gap-3 rounded-2xl border border-default-200 px-4 py-4 md:flex-row md:items-center md:justify-between"
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
  const [fromFilter, setFromFilter] = useState(
    dayjs().tz(TIMEZONE).startOf("month").format("YYYY-MM-DD")
  );
  const [toFilter, setToFilter] = useState(dayjs().tz(TIMEZONE).format("YYYY-MM-DD"));
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
        <TextField
          className="w-40"
          type="number"
          value={employeeIdFilter}
          onChange={setEmployeeIdFilter}
        >
          <Label>ID Empleado</Label>
          <Input placeholder="Todos" />
        </TextField>

        <TextField className="w-44" type="date" value={fromFilter} onChange={setFromFilter}>
          <Label>Desde</Label>
          <Input />
        </TextField>

        <TextField className="w-44" type="date" value={toFilter} onChange={setToFilter}>
          <Label>Hasta</Label>
          <Input />
        </TextField>

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
