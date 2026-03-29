import { Button, Input, Label, ListBox, Select, Skeleton, TextField } from "@heroui/react";
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
        type,
        markedAt: new Date(markedAt).toISOString(),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance", "list"] });
      onClose();
    },
    onError: (err) => {
      setError(toAttendanceApiError(err).message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Corrección manual</h2>

        <div className="flex flex-col gap-3">
          <TextField type="number" value={employeeId} onChange={setEmployeeId}>
            <Label>ID Empleado</Label>
            <Input placeholder="Ej: 1" />
          </TextField>

          <div>
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
          </div>

          <TextField type="datetime-local" value={markedAt} onChange={setMarkedAt}>
            <Label>Fecha y hora</Label>
            <Input />
          </TextField>

          <TextField value={notes} onChange={setNotes}>
            <Label>Notas (opcional)</Label>
            <Input placeholder="Motivo de la corrección..." />
          </TextField>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onPress={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              isDisabled={!employeeId || mutation.isPending}
              onPress={() => mutation.mutate()}
            >
              {mutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tabla de marcas ───────────────────────────────────────────────────────────

interface MarksTableProps {
  marks: AttendanceMark[];
  onDelete: (id: number) => void;
  isDeletingId: number | null;
}

function MarksTable({ marks, onDelete, isDeletingId }: MarksTableProps) {
  if (marks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-400">
        No hay registros para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Empleado</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Hora (Santiago)</th>
            <th className="px-4 py-3">Red</th>
            <th className="px-4 py-3">GPS</th>
            <th className="px-4 py-3">Notas</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {marks.map((mark) => (
            <tr key={mark.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              <td className="px-4 py-3">
                <p className="font-medium">{mark.employeeName ?? `ID ${mark.employeeId}`}</p>
                {mark.employeeRut && <p className="text-xs text-gray-400">{mark.employeeRut}</p>}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    mark.type === "CLOCK_IN"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {mark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
                </span>
              </td>
              <td className="px-4 py-3 font-medium">
                {dayjs(mark.markedAt).tz(TIMEZONE).format("DD/MM/YYYY HH:mm")}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium ${
                    mark.isOfficeNetwork ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {mark.isOfficeNetwork ? "Oficina" : "Externa"}
                </span>
              </td>
              <td className="px-4 py-3">
                {mark.latitude !== null && mark.longitude !== null ? (
                  <a
                    href={`https://www.google.com/maps?q=${mark.latitude},${mark.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                    title={`Precisión: ${mark.accuracyMeters?.toFixed(0) ?? "?"}m`}
                  >
                    Ver mapa
                  </a>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500">{mark.notes ?? "—"}</td>
              <td className="px-4 py-3">
                <Button
                  variant="danger-soft"
                  isDisabled={isDeletingId === mark.id}
                  onPress={() => onDelete(mark.id)}
                >
                  {isDeletingId === mark.id ? "..." : "Eliminar"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          type="number"
          value={employeeIdFilter}
          onChange={setEmployeeIdFilter}
          className="w-40"
        >
          <Label>ID Empleado</Label>
          <Input placeholder="Todos" />
        </TextField>

        <TextField type="date" value={fromFilter} onChange={setFromFilter} className="w-44">
          <Label>Desde</Label>
          <Input />
        </TextField>

        <TextField type="date" value={toFilter} onChange={setToFilter} className="w-44">
          <Label>Hasta</Label>
          <Input />
        </TextField>

        <div className="ml-auto">
          <Button variant="primary" onPress={() => setShowModal(true)}>
            Corrección manual
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : (
        <MarksTable
          marks={marks}
          onDelete={(id) => deleteMutation.mutate(id)}
          isDeletingId={deletingId}
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
        <h1 className="text-2xl font-bold text-gray-900">Asistencia</h1>
        <p className="mt-1 text-sm text-gray-500">
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
