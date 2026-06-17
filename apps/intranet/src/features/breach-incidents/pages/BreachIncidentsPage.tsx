import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type {
  BreachIncidentDto,
  BreachSeverity,
  BreachStatus,
} from "@finanzas/orpc-contracts/breach-incidents";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  breachIncidentsORPCClient,
  toBreachIncidentsApiError,
} from "@/features/breach-incidents/orpc";
import { formatChile } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["breach-incidents"] as const;

// La Ley 21.719 (art. 14 sexies) exige notificar a la Agencia "por los medios
// más expeditos posibles y sin dilaciones indebidas" — NO fija 72 h. Usamos 72 h
// solo como gatillo operativo de urgencia (alineado con el plazo de actualización
// de la Ley 21.663 / ANCI, que sí aplica a la clínica como servicio esencial).
const URGENCY_TRIGGER_MS = 72 * 60 * 60 * 1000;

const SEVERITY_LABEL: Record<BreachSeverity, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const SEVERITY_COLOR: Record<BreachSeverity, "default" | "warning" | "danger"> = {
  LOW: "default",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};

const STATUS_LABEL: Record<BreachStatus, string> = {
  DETECTED: "Detectada",
  NOTIFYING: "Notificando",
  NOTIFIED: "Notificada",
  CLOSED: "Cerrada",
};

const STATUS_COLOR: Record<BreachStatus, "default" | "warning" | "accent" | "success"> = {
  DETECTED: "warning",
  NOTIFYING: "accent",
  NOTIFIED: "success",
  CLOSED: "default",
};

const SEVERITY_OPTIONS: BreachSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const EMPTY_FORM = {
  detectedAt: today(getLocalTimeZone()).toString(),
  description: "",
  severity: "MEDIUM" as BreachSeverity,
  affectedData: "",
  affectedCount: "",
};

function isUrgent(incident: BreachIncidentDto): boolean {
  if (incident.status !== "DETECTED") return false;
  return Date.now() - incident.detectedAt.getTime() > URGENCY_TRIGGER_MS;
}

export function BreachIncidentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await breachIncidentsORPCClient.list({});
        return res.incidents;
      } catch (error) {
        throw toBreachIncidentsApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.detectedAt) throw new Error("Indica la fecha de detección");
      if (!form.description.trim()) throw new Error("Indica una descripción");
      const count = form.affectedCount.trim() ? Number(form.affectedCount) : undefined;
      if (count !== undefined && (!Number.isFinite(count) || count < 0)) {
        throw new Error("Cantidad de afectados inválida");
      }
      try {
        return await breachIncidentsORPCClient.create({
          detectedAt: form.detectedAt,
          description: form.description.trim(),
          severity: form.severity,
          affectedData: form.affectedData.trim() || undefined,
          affectedCount: count,
        });
      } catch (error) {
        throw toBreachIncidentsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Incidente registrado");
      void invalidate();
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const update = useMutation({
    mutationFn: async (input: Parameters<typeof breachIncidentsORPCClient.update>[0]) => {
      try {
        return await breachIncidentsORPCClient.update(input);
      } catch (error) {
        throw toBreachIncidentsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Incidente actualizado");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const markAgencyNotified = (incident: BreachIncidentDto) =>
    update.mutate({
      id: incident.id,
      agencyNotifiedAt: new Date().toISOString(),
      status: incident.status === "DETECTED" ? "NOTIFYING" : incident.status,
    });

  const markSubjectsNotified = (incident: BreachIncidentDto) =>
    update.mutate({
      id: incident.id,
      subjectsNotifiedAt: new Date().toISOString(),
      status: "NOTIFIED",
    });

  const changeStatus = (incident: BreachIncidentDto, status: BreachStatus) =>
    update.mutate({ id: incident.id, status });

  const columns: ColumnDef<BreachIncidentDto>[] = [
    {
      header: "Detectado",
      accessorKey: "detectedAt",
      cell: ({ row }) => {
        const urgent = isUrgent(row.original);
        return (
          <span className={urgent ? "font-semibold text-danger text-sm" : "text-sm"}>
            {formatChile(row.original.detectedAt, "DD/MM/YYYY HH:mm")}
            {urgent ? " · reportar sin demora" : ""}
          </span>
        );
      },
    },
    {
      header: "Severidad",
      accessorKey: "severity",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={SEVERITY_COLOR[row.original.severity]}>
          {SEVERITY_LABEL[row.original.severity]}
        </Chip>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status]}>
          {STATUS_LABEL[row.original.status]}
        </Chip>
      ),
    },
    {
      header: "Afectados",
      accessorKey: "affectedCount",
      cell: ({ row }) => <span className="text-sm">{row.original.affectedCount ?? "—"}</span>,
    },
    {
      header: "Agencia notif.",
      accessorKey: "agencyNotifiedAt",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.agencyNotifiedAt
            ? formatChile(row.original.agencyNotifiedAt, "DD/MM/YYYY")
            : "—"}
        </span>
      ),
    },
    {
      header: "Titulares notif.",
      accessorKey: "subjectsNotifiedAt",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.subjectsNotifiedAt
            ? formatChile(row.original.subjectsNotifiedAt, "DD/MM/YYYY")
            : "—"}
        </span>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => {
        const incident = row.original;
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {!incident.agencyNotifiedAt && (
              <Button
                size="sm"
                variant="ghost"
                isPending={update.isPending}
                onPress={() => markAgencyNotified(incident)}
              >
                Marcar agencia notificada
              </Button>
            )}
            {!incident.subjectsNotifiedAt && (
              <Button
                size="sm"
                variant="ghost"
                isPending={update.isPending}
                onPress={() => markSubjectsNotified(incident)}
              >
                Marcar titulares notificados
              </Button>
            )}
            {incident.status !== "CLOSED" && (
              <Button
                size="sm"
                variant="outline"
                isPending={update.isPending}
                onPress={() => changeStatus(incident, "CLOSED")}
              >
                Cerrar
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck aria-hidden="true" size={22} />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">Incidentes de brecha</h1>
          <p className="text-default-500 text-sm">
            Registro de brechas de datos personales (Ley 21.719, art. 14 sexies). Se debe notificar
            a la Agencia "por los medios más expeditos posibles y sin dilaciones indebidas". El
            gatillo de 72 h es operativo (best-practice y plazo de la Ley 21.663 / ANCI).
          </p>
        </div>
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">Registrar incidente</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AppDatePicker
            label="Fecha de detección"
            value={form.detectedAt}
            onChange={(v) => setForm((f) => ({ ...f, detectedAt: v }))}
          />
          <div className="space-y-1">
            <Label className="font-medium text-sm">Severidad</Label>
            <Select
              aria-label="Severidad"
              selectedKey={form.severity}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, severity: String(k) as BreachSeverity }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SEVERITY_OPTIONS.map((s) => (
                    <ListBox.Item key={s} id={s} textValue={SEVERITY_LABEL[s]}>
                      {SEVERITY_LABEL[s]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.affectedCount}
            onChange={(v) => setForm((f) => ({ ...f, affectedCount: v }))}
          >
            <Label>Cantidad de afectados</Label>
            <Input placeholder="Opcional" inputMode="numeric" />
          </TextField>
          <TextField
            className="sm:col-span-2 lg:col-span-3"
            value={form.affectedData}
            onChange={(v) => setForm((f) => ({ ...f, affectedData: v }))}
          >
            <Label>Datos afectados</Label>
            <Input placeholder="ej. nombres, RUT, correos" />
          </TextField>
          <TextField
            className="sm:col-span-2 lg:col-span-3"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          >
            <Label>Descripción</Label>
            <TextArea placeholder="Qué ocurrió, alcance y medidas iniciales" rows={3} />
          </TextField>
        </div>
        <div className="flex justify-end">
          <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
            <Plus aria-hidden="true" size={16} />
            Registrar
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando incidentes" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin incidentes de brecha registrados."
        />
      )}
    </div>
  );
}
