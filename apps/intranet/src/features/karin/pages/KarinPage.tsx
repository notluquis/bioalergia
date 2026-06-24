import { Button, Card, Chip, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import type { KarinReportDto, KarinReportType, KarinStatus } from "@finanzas/orpc-contracts/karin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { karinORPCClient, toKarinApiError } from "@/features/karin/orpc";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const KARIN_KEY = ["karin", "list"] as const;

const TYPE_LABEL: Record<KarinReportType, string> = {
  ACOSO_LABORAL: "Acoso laboral",
  ACOSO_SEXUAL: "Acoso sexual",
  VIOLENCIA: "Violencia",
};

const STATUS_LABEL: Record<KarinStatus, string> = {
  RECIBIDA: "Recibida",
  EN_RESGUARDO: "En resguardo",
  REMITIDA_DT: "Remitida a la DT",
  EN_INVESTIGACION: "En investigación",
  CERRADA: "Cerrada",
};

const STATUS_COLOR: Record<KarinStatus, "default" | "warning" | "success" | "danger"> = {
  RECIBIDA: "warning",
  EN_RESGUARDO: "danger",
  REMITIDA_DT: "default",
  EN_INVESTIGACION: "default",
  CERRADA: "success",
};

type ResolveStatus = "EN_RESGUARDO" | "REMITIDA_DT" | "EN_INVESTIGACION" | "CERRADA";

const RESOLVE_OPTIONS: { id: ResolveStatus; label: string }[] = [
  { id: "EN_RESGUARDO", label: "En resguardo" },
  { id: "REMITIDA_DT", label: "Remitida a la DT" },
  { id: "EN_INVESTIGACION", label: "En investigación" },
  { id: "CERRADA", label: "Cerrada" },
];

const EMPTY_REPORT = {
  reportType: "ACOSO_LABORAL" as KarinReportType,
  reporterName: "",
  reporterRut: "",
  reporterContact: "",
  reportedPerson: "",
  description: "",
};

function isOverdue(r: KarinReportDto): boolean {
  return r.status !== "CERRADA" && new Date(r.remitirDueAt).getTime() < Date.now();
}

export function KarinPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KARIN_KEY,
    queryFn: async () => {
      try {
        const res = await karinORPCClient.listReports({});
        return res.reports;
      } catch (error) {
        throw toKarinApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_REPORT });
  const [resolveFor, setResolveFor] = useState<KarinReportDto | null>(null);
  const [resolveStatus, setResolveStatus] = useState<ResolveStatus>("EN_RESGUARDO");
  const [resolveText, setResolveText] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KARIN_KEY });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.reporterName.trim()) throw new Error("Indica el nombre del denunciante");
      if (!form.description.trim()) throw new Error("Describe los hechos");
      try {
        return await karinORPCClient.createReport({
          reportType: form.reportType,
          reporterName: form.reporterName.trim(),
          reporterRut: form.reporterRut.trim() || undefined,
          reporterContact: form.reporterContact.trim() || undefined,
          reportedPerson: form.reportedPerson.trim() || undefined,
          description: form.description.trim(),
        });
      } catch (error) {
        throw toKarinApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Denuncia registrada");
      void invalidate();
      setForm({ ...EMPTY_REPORT });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      if (!resolveFor) throw new Error("Selecciona una denuncia");
      try {
        return await karinORPCClient.resolveReport({
          id: resolveFor.id,
          status: resolveStatus,
          resolution: resolveText.trim() || undefined,
        });
      } catch (error) {
        throw toKarinApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Denuncia actualizada");
      void invalidate();
      setResolveFor(null);
      setResolveText("");
      setResolveStatus("EN_RESGUARDO");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const columns: ColumnDef<KarinReportDto>[] = [
    {
      header: "Tipo",
      accessorKey: "reportType",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft">
          {TYPE_LABEL[row.original.reportType]}
        </Chip>
      ),
    },
    {
      header: "Denunciante",
      accessorKey: "reporterName",
      cell: ({ row }) => <span className="text-sm">{row.original.reporterName}</span>,
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
      header: "Recibida",
      accessorKey: "receivedAt",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.receivedAt, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "Remitir a DT",
      accessorKey: "remitirDueAt",
      cell: ({ row }) => (
        <span className={isOverdue(row.original) ? "font-semibold text-danger text-sm" : "text-sm"}>
          {formatChile(row.original.remitirDueAt, "DD/MM/YYYY")}
          {isOverdue(row.original) ? " (vencida)" : ""}
        </span>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          {row.original.status !== "CERRADA" && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setResolveFor(row.original);
                setResolveStatus("EN_RESGUARDO");
                setResolveText(row.original.resolution ?? "");
              }}
            >
              Gestionar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Denuncias Ley Karin"
        description="Canal confidencial de denuncia (Ley 21.643 + Decreto 21/2024): acoso laboral, sexual o violencia. Plazos: resguardo inmediato, remisión a la Inspección del Trabajo en 3 días hábiles, investigación en 30 días hábiles."
        icon={<ShieldAlert size={22} />}
      />

      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-base">Nueva denuncia (Anexo A)</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="font-medium text-sm">Tipo de denuncia</Label>
              <Select
                aria-label="Tipo de denuncia"
                selectedKey={form.reportType}
                onSelectionChange={(k) =>
                  setForm((f) => ({ ...f, reportType: String(k) as KarinReportType }))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {(Object.keys(TYPE_LABEL) as KarinReportType[]).map((t) => (
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
              value={form.reporterName}
              onChange={(v) => setForm((f) => ({ ...f, reporterName: v }))}
            >
              <Label>Nombre del denunciante</Label>
              <Input placeholder="Nombre y apellido" />
            </TextField>
            <TextField
              value={form.reporterRut}
              onChange={(v) => setForm((f) => ({ ...f, reporterRut: v }))}
            >
              <Label>RUT (opcional)</Label>
              <Input placeholder="12.345.678-9" />
            </TextField>
            <TextField
              value={form.reporterContact}
              onChange={(v) => setForm((f) => ({ ...f, reporterContact: v }))}
            >
              <Label>Contacto (opcional)</Label>
              <Input placeholder="Email o teléfono" />
            </TextField>
            <TextField
              value={form.reportedPerson}
              onChange={(v) => setForm((f) => ({ ...f, reportedPerson: v }))}
            >
              <Label>Persona denunciada (opcional)</Label>
              <Input placeholder="Nombre" />
            </TextField>
            <TextField
              className="lg:col-span-3"
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            >
              <Label>Relato de los hechos</Label>
              <Input placeholder="Describe los hechos, fechas y testigos" />
            </TextField>
          </div>
          <div className="flex justify-end">
            <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
              <Plus size={16} aria-hidden="true" />
              Registrar denuncia
            </Button>
          </div>
        </Card>

        {resolveFor && (
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-base">
              Gestionar denuncia de {resolveFor.reporterName}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="font-medium text-sm">Nuevo estado</Label>
                <Select
                  aria-label="Nuevo estado"
                  selectedKey={resolveStatus}
                  onSelectionChange={(k) => setResolveStatus(String(k) as ResolveStatus)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {RESOLVE_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                          {opt.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <TextField value={resolveText} onChange={setResolveText}>
                <Label>Resolución / nota (opcional)</Label>
                <Input placeholder="Medidas adoptadas o nota interna" />
              </TextField>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onPress={() => {
                  setResolveFor(null);
                  setResolveText("");
                }}
              >
                Cancelar
              </Button>
              <Button isPending={resolve.isPending} onPress={() => resolve.mutate()}>
                Guardar
              </Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner label="Cargando denuncias" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data ?? []}
            enablePagination={false}
            enableToolbar={false}
            noDataMessage="Sin denuncias registradas."
          />
        )}
      </div>
    </Page>
  );
}
