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
  DataRightsRequestDto,
  DataRightsResolveStatus,
  DataRightsStatus,
  DataRightsType,
} from "@finanzas/orpc-contracts/data-rights";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Fingerprint, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { dataRightsORPCClient, toDataRightsApiError } from "@/features/data-rights/orpc";
import { formatChile } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["settings", "data-rights"] as const;

const TYPE_LABEL: Record<DataRightsType, string> = {
  ACCESS: "Acceso",
  RECTIFICATION: "Rectificación",
  DELETION: "Cancelación",
  PORTABILITY: "Portabilidad",
  OPPOSITION: "Oposición",
  BLOCKING: "Bloqueo",
};

const STATUS_LABEL: Record<DataRightsStatus, string> = {
  RECEIVED: "Recibida",
  IN_PROGRESS: "En proceso",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
};

const STATUS_COLOR: Record<DataRightsStatus, "default" | "warning" | "success" | "danger"> = {
  RECEIVED: "default",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  REJECTED: "danger",
};

const RESOLVE_LABEL: Record<DataRightsResolveStatus, string> = {
  IN_PROGRESS: "En proceso",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
};

const TYPE_ORDER: DataRightsType[] = [
  "ACCESS",
  "RECTIFICATION",
  "DELETION",
  "PORTABILITY",
  "OPPOSITION",
  "BLOCKING",
];

const RESOLVE_ORDER: DataRightsResolveStatus[] = ["IN_PROGRESS", "RESOLVED", "REJECTED"];

const EMPTY_FORM = {
  type: "ACCESS" as DataRightsType,
  requesterName: "",
  requesterRut: "",
  requesterEmail: "",
  patientId: "",
  notes: "",
};

const fmtDate = (d: Date) => formatChile(d, "DD/MM/YYYY");

function isOverdue(p: DataRightsRequestDto): boolean {
  return p.dueAt.getTime() < Date.now() && p.status !== "RESOLVED" && p.status !== "REJECTED";
}

export function DataRightsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await dataRightsORPCClient.list({});
        return res.requests;
      } catch (error) {
        throw toDataRightsApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  // Estado del panel de resolución inline (por solicitud).
  const [resolving, setResolving] = useState<DataRightsRequestDto | null>(null);
  const [resolveStatus, setResolveStatus] = useState<DataRightsResolveStatus>("RESOLVED");
  const [resolution, setResolution] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.requesterName.trim()) throw new Error("Indica el nombre del solicitante");
      const patientIdRaw = form.patientId.trim();
      let patientId: number | undefined;
      if (patientIdRaw) {
        const n = Number(patientIdRaw);
        if (!Number.isInteger(n) || n < 1) throw new Error("ID de paciente inválido");
        patientId = n;
      }
      try {
        return await dataRightsORPCClient.create({
          type: form.type,
          requesterName: form.requesterName.trim(),
          requesterRut: form.requesterRut.trim() || undefined,
          requesterEmail: form.requesterEmail.trim() || undefined,
          patientId,
          notes: form.notes.trim() || undefined,
        });
      } catch (error) {
        throw toDataRightsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Solicitud registrada");
      void invalidate();
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const resolve = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: DataRightsResolveStatus;
      resolution?: string;
    }) => {
      try {
        return await dataRightsORPCClient.resolve(vars);
      } catch (error) {
        throw toDataRightsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Solicitud actualizada");
      void invalidate();
      setResolving(null);
      setResolution("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const extend = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await dataRightsORPCClient.extend({ id });
      } catch (error) {
        throw toDataRightsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Plazo prorrogado +30 días");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo prorrogar"),
  });

  const onOpenResolve = (p: DataRightsRequestDto) => {
    setResolving(p);
    setResolveStatus(p.status === "REJECTED" ? "REJECTED" : "RESOLVED");
    setResolution(p.resolution ?? "");
  };

  // La Ley 21.719 permite una sola prórroga (+30 días corridos): solo si la
  // solicitud no está cerrada y no se prorrogó antes.
  const canExtend = (p: DataRightsRequestDto): boolean =>
    p.extendedAt === null && p.status !== "RESOLVED" && p.status !== "REJECTED";

  const onExtend = async (p: DataRightsRequestDto) => {
    const ok = await confirmAction({
      title: "Prorrogar plazo de respuesta",
      description: `¿Extender el plazo de la solicitud de "${p.requesterName}" en 30 días corridos? La Ley 21.719 permite una única prórroga por solicitud.`,
      confirmLabel: "Prorrogar",
    });
    if (ok) extend.mutate(p.id);
  };

  const onConfirmResolve = async () => {
    if (!resolving) return;
    const terminal = resolveStatus === "RESOLVED" || resolveStatus === "REJECTED";
    const ok = terminal
      ? await confirmAction({
          title: resolveStatus === "RESOLVED" ? "Resolver solicitud" : "Rechazar solicitud",
          description: `¿Marcar la solicitud de "${resolving.requesterName}" como ${RESOLVE_LABEL[resolveStatus].toLowerCase()}? Se registrará la fecha de resolución.`,
          confirmLabel: RESOLVE_LABEL[resolveStatus],
          variant: resolveStatus === "REJECTED" ? "danger" : "default",
        })
      : true;
    if (!ok) return;
    resolve.mutate({
      id: resolving.id,
      status: resolveStatus,
      resolution: resolution.trim() || undefined,
    });
  };

  const columns: ColumnDef<DataRightsRequestDto>[] = [
    {
      header: "Tipo",
      accessorKey: "type",
      cell: ({ row }) => (
        <span className="text-sm">{TYPE_LABEL[row.original.type] ?? row.original.type}</span>
      ),
    },
    {
      header: "Solicitante",
      accessorKey: "requesterName",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.requesterName}</span>
          {row.original.requesterRut ? (
            <span className="font-mono text-default-500 text-xs">{row.original.requesterRut}</span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status]}>
          {STATUS_LABEL[row.original.status] ?? row.original.status}
        </Chip>
      ),
    },
    {
      header: "Recibida",
      accessorKey: "receivedAt",
      cell: ({ row }) => <span className="text-sm">{fmtDate(row.original.receivedAt)}</span>,
    },
    {
      header: "Vence",
      accessorKey: "dueAt",
      cell: ({ row }) => {
        const overdue = isOverdue(row.original);
        return (
          <div className="flex flex-col">
            <span className={overdue ? "font-semibold text-danger text-sm" : "text-sm"}>
              {fmtDate(row.original.dueAt)}
              {overdue ? " (vencida)" : ""}
            </span>
            {row.original.extendedAt ? (
              <span className="text-default-400 text-xs">prorrogada</span>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {canExtend(row.original) ? (
            <Button
              size="sm"
              variant="ghost"
              isPending={extend.isPending}
              onPress={() => void onExtend(row.original)}
            >
              Prorrogar
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onPress={() => onOpenResolve(row.original)}>
            Gestionar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Fingerprint size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">Derechos del titular</h1>
          <p className="text-default-500 text-sm">
            Solicitudes ARCO+ (Ley 21.719): acceso, rectificación, cancelación, portabilidad,
            oposición y bloqueo. Plazo legal de respuesta: 30 días corridos, prorrogable una vez por
            otros 30.
          </p>
        </div>
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">Nueva solicitud</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="font-medium text-sm">Tipo de derecho</Label>
            <Select
              aria-label="Tipo de derecho"
              selectedKey={form.type}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, type: String(k) as DataRightsType }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {TYPE_ORDER.map((t) => (
                    <ListBox.Item key={t} id={t} textValue={TYPE_LABEL[t]}>
                      {TYPE_LABEL[t]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.requesterName}
            onChange={(v) => setForm((f) => ({ ...f, requesterName: v }))}
          >
            <Label>Solicitante</Label>
            <Input placeholder="Nombre completo" />
          </TextField>
          <TextField
            value={form.requesterRut}
            onChange={(v) => setForm((f) => ({ ...f, requesterRut: v }))}
          >
            <Label>RUT (opcional)</Label>
            <Input placeholder="12.345.678-9" />
          </TextField>
          <TextField
            value={form.requesterEmail}
            onChange={(v) => setForm((f) => ({ ...f, requesterEmail: v }))}
          >
            <Label>Email (opcional)</Label>
            <Input type="email" placeholder="correo@ejemplo.cl" />
          </TextField>
          <TextField
            value={form.patientId}
            onChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
          >
            <Label>ID paciente (opcional)</Label>
            <Input placeholder="123" inputMode="numeric" />
          </TextField>
        </div>
        <div className="space-y-1">
          <Label className="font-medium text-sm">Notas</Label>
          <TextArea
            aria-label="Notas"
            fullWidth
            rows={3}
            placeholder="Detalle de la solicitud (opcional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="flex justify-end">
          <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
            <Plus size={16} aria-hidden="true" />
            Registrar
          </Button>
        </div>
      </Card>

      {resolving ? (
        <Card className="mb-6 space-y-4 border-primary/40 p-5">
          <h2 className="font-semibold text-base">
            Gestionar solicitud — {resolving.requesterName}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="font-medium text-sm">Nuevo estado</Label>
              <Select
                aria-label="Nuevo estado"
                selectedKey={resolveStatus}
                onSelectionChange={(k) => setResolveStatus(String(k) as DataRightsResolveStatus)}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {RESOLVE_ORDER.map((s) => (
                      <ListBox.Item key={s} id={s} textValue={RESOLVE_LABEL[s]}>
                        {RESOLVE_LABEL[s]}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Resolución / fundamento</Label>
            <TextArea
              aria-label="Resolución"
              fullWidth
              rows={3}
              placeholder="Describe la respuesta entregada o el motivo del rechazo (opcional)"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onPress={() => {
                setResolving(null);
                setResolution("");
              }}
            >
              Cancelar
            </Button>
            <Button isPending={resolve.isPending} onPress={() => void onConfirmResolve()}>
              Guardar estado
            </Button>
          </div>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando solicitudes" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin solicitudes de derechos del titular."
        />
      )}
    </div>
  );
}
