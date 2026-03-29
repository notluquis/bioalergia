import {
  Alert,
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Suspense, useState } from "react";
import type {
  attendanceMarkSchema,
  attendanceMarkTypeSchema,
} from "@finanzas/orpc-contracts/attendance";
import type { z } from "zod";
import { attendanceORPCClient, toAttendanceApiError } from "./orpc";
import { attendanceQueries } from "./queries";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type AttendanceMark = z.infer<typeof attendanceMarkSchema> & {
  employeeName?: string;
  employeeRut?: string;
};
type MarkType = z.infer<typeof attendanceMarkTypeSchema>;

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
}

function MarksTable({ isDeletingId, marks, onDelete }: MarksTableProps) {
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
    <Table>
      <TableHeader>
        <TableColumn isRowHeader>Empleado</TableColumn>
        <TableColumn>Tipo</TableColumn>
        <TableColumn>Hora (Santiago)</TableColumn>
        <TableColumn>Red</TableColumn>
        <TableColumn>GPS</TableColumn>
        <TableColumn>Notas</TableColumn>
        <TableColumn>{""}</TableColumn>
      </TableHeader>
      <TableBody>
        {marks.map((mark) => (
          <TableRow key={mark.id}>
            <TableCell>
              <p className="font-medium">{mark.employeeName ?? `ID ${mark.employeeId}`}</p>
              {mark.employeeRut && (
                <p className="text-xs text-foreground-400">{mark.employeeRut}</p>
              )}
            </TableCell>
            <TableCell>
              <Chip
                color={mark.type === "CLOCK_IN" ? "success" : "danger"}
                size="sm"
                variant="soft"
              >
                {mark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
              </Chip>
            </TableCell>
            <TableCell className="font-medium">
              {dayjs(mark.markedAt).tz(TIMEZONE).format("DD/MM/YYYY HH:mm")}
            </TableCell>
            <TableCell>
              <Chip
                color={mark.isOfficeNetwork ? "success" : "default"}
                size="sm"
                variant="secondary"
              >
                {mark.isOfficeNetwork ? "Oficina" : "Externa"}
              </Chip>
            </TableCell>
            <TableCell>
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
            </TableCell>
            <TableCell className="text-foreground-500">{mark.notes ?? "—"}</TableCell>
            <TableCell>
              <Button
                isDisabled={isDeletingId === mark.id}
                variant="danger-soft"
                onPress={() => onDelete(mark.id)}
              >
                {isDeletingId === mark.id ? "..." : "Eliminar"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const params = {
    employeeId: employeeIdFilter ? Number(employeeIdFilter) : undefined,
    from: fromFilter || undefined,
    to: toFilter || undefined,
  };

  const { data, isLoading } = useQuery(attendanceQueries.list(params));
  const marks = data?.marks ?? [];

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
        />
      )}

      {showModal && <AdminMarkModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export function AdminAttendancePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Asistencia</h1>
        <p className="mt-1 text-sm text-foreground-500">
          Registros de marcaje de entrada y salida del equipo.
        </p>
      </div>
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
