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
  ProcessingActivityDto,
  ProcessingActivityLegalBasis,
} from "@finanzas/orpc-contracts/processing-activities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  processingActivitiesORPCClient,
  toProcessingActivitiesApiError,
} from "@/features/processing-activities/orpc";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["settings", "processing-activities"] as const;

const LEGAL_BASIS_LABEL: Record<ProcessingActivityLegalBasis, string> = {
  CONSENT: "Consentimiento",
  CONTRACT: "Contrato",
  LEGAL_OBLIGATION: "Obligación legal",
  VITAL_INTEREST: "Interés vital",
  LEGITIMATE_INTEREST: "Interés legítimo",
  HEALTH_CARE: "Atención de salud",
};

const LEGAL_BASIS_ORDER: ProcessingActivityLegalBasis[] = [
  "HEALTH_CARE",
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "LEGITIMATE_INTEREST",
  "VITAL_INTEREST",
];

const EMPTY_FORM = {
  id: "",
  name: "",
  purpose: "",
  legalBasis: "HEALTH_CARE" as ProcessingActivityLegalBasis,
  dataCategories: "",
  dataSubjects: "",
  recipients: "",
  retentionPeriod: "",
  securityMeasures: "",
  internationalTransfer: false,
  isActive: true,
  notes: "",
};

export function ProcessingActivitiesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await processingActivitiesORPCClient.list();
        return res.activities;
      } catch (error) {
        throw toProcessingActivitiesApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Indica el nombre de la actividad");
      if (!form.purpose.trim()) throw new Error("Indica la finalidad");
      if (!form.dataCategories.trim()) throw new Error("Indica las categorías de datos");
      if (!form.dataSubjects.trim()) throw new Error("Indica las categorías de titulares");
      try {
        return await processingActivitiesORPCClient.upsert({
          id: form.id || undefined,
          name: form.name.trim(),
          purpose: form.purpose.trim(),
          legalBasis: form.legalBasis,
          dataCategories: form.dataCategories.trim(),
          dataSubjects: form.dataSubjects.trim(),
          recipients: form.recipients.trim() || undefined,
          retentionPeriod: form.retentionPeriod.trim() || undefined,
          securityMeasures: form.securityMeasures.trim() || undefined,
          internationalTransfer: form.internationalTransfer,
          isActive: form.isActive,
          notes: form.notes.trim() || undefined,
        });
      } catch (error) {
        throw toProcessingActivitiesApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Actividad guardada");
      void invalidate();
      setForm({ ...EMPTY_FORM });
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await processingActivitiesORPCClient.remove({ id });
      } catch (error) {
        throw toProcessingActivitiesApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Actividad eliminada");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const onEdit = (a: ProcessingActivityDto) => {
    setForm({
      id: a.id,
      name: a.name,
      purpose: a.purpose,
      legalBasis: a.legalBasis,
      dataCategories: a.dataCategories,
      dataSubjects: a.dataSubjects,
      recipients: a.recipients ?? "",
      retentionPeriod: a.retentionPeriod ?? "",
      securityMeasures: a.securityMeasures ?? "",
      internationalTransfer: a.internationalTransfer,
      isActive: a.isActive,
      notes: a.notes ?? "",
    });
    setEditing(true);
  };

  const onDelete = async (a: ProcessingActivityDto) => {
    const ok = await confirmAction({
      title: "Eliminar actividad de tratamiento",
      description: `¿Eliminar "${a.name}" del registro (RAT)?`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (ok) remove.mutate(a.id);
  };

  const columns: ColumnDef<ProcessingActivityDto>[] = [
    {
      header: "Actividad",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.name}</span>
          <span className="line-clamp-1 text-default-500 text-xs">{row.original.purpose}</span>
        </div>
      ),
    },
    {
      header: "Base de licitud",
      accessorKey: "legalBasis",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft">
          {LEGAL_BASIS_LABEL[row.original.legalBasis] ?? row.original.legalBasis}
        </Chip>
      ),
    },
    {
      header: "Categorías de datos",
      accessorKey: "dataCategories",
      cell: ({ row }) => <span className="text-sm">{row.original.dataCategories}</span>,
    },
    {
      header: "Conservación",
      accessorKey: "retentionPeriod",
      cell: ({ row }) => <span className="text-sm">{row.original.retentionPeriod ?? "—"}</span>,
    },
    {
      header: "Estado",
      accessorKey: "isActive",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={row.original.isActive ? "success" : "default"}>
          {row.original.isActive ? "Activa" : "Inactiva"}
        </Chip>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onPress={() => onEdit(row.original)}>
            Editar
          </Button>
          <Button size="sm" variant="danger" onPress={() => void onDelete(row.original)}>
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ListChecks size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">
            Registro de tratamientos (RAT)
          </h1>
          <p className="text-default-500 text-sm">
            Inventario de actividades de tratamiento de datos personales que exige la Ley 21.719:
            finalidad, base de licitud, categorías de datos y titulares, conservación y medidas.
          </p>
        </div>
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">
          {editing ? "Editar actividad" : "Nueva actividad"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))}>
            <Label>Nombre</Label>
            <Input placeholder="ej. Gestión de fichas clínicas" />
          </TextField>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Base de licitud</Label>
            <Select
              aria-label="Base de licitud"
              selectedKey={form.legalBasis}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, legalBasis: String(k) as ProcessingActivityLegalBasis }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {LEGAL_BASIS_ORDER.map((b) => (
                    <ListBox.Item key={b} id={b} textValue={LEGAL_BASIS_LABEL[b]}>
                      {LEGAL_BASIS_LABEL[b]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.dataCategories}
            onChange={(v) => setForm((f) => ({ ...f, dataCategories: v }))}
          >
            <Label>Categorías de datos</Label>
            <Input placeholder="Identificación, salud, contacto" />
          </TextField>
          <TextField
            value={form.dataSubjects}
            onChange={(v) => setForm((f) => ({ ...f, dataSubjects: v }))}
          >
            <Label>Categorías de titulares</Label>
            <Input placeholder="Pacientes, empleados" />
          </TextField>
          <TextField
            value={form.recipients}
            onChange={(v) => setForm((f) => ({ ...f, recipients: v }))}
          >
            <Label>Destinatarios (opcional)</Label>
            <Input placeholder="Encargados, terceros" />
          </TextField>
          <TextField
            value={form.retentionPeriod}
            onChange={(v) => setForm((f) => ({ ...f, retentionPeriod: v }))}
          >
            <Label>Plazo de conservación (opcional)</Label>
            <Input placeholder="ej. 15 años (ficha clínica)" />
          </TextField>
        </div>
        <div className="space-y-1">
          <Label className="font-medium text-sm">Finalidad</Label>
          <TextArea
            aria-label="Finalidad"
            fullWidth
            rows={2}
            placeholder="Para qué se tratan los datos"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="font-medium text-sm">Medidas de seguridad (opcional)</Label>
          <TextArea
            aria-label="Medidas de seguridad"
            fullWidth
            rows={2}
            placeholder="Cifrado, control de acceso, audit log, etc."
            value={form.securityMeasures}
            onChange={(e) => setForm((f) => ({ ...f, securityMeasures: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.internationalTransfer}
              onChange={(e) => setForm((f) => ({ ...f, internationalTransfer: e.target.checked }))}
            />
            Transferencia internacional
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Activa
          </label>
        </div>
        <div className="flex justify-end gap-2">
          {editing && (
            <Button
              variant="outline"
              onPress={() => {
                setForm({ ...EMPTY_FORM });
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          )}
          <Button className="gap-2" isPending={upsert.isPending} onPress={() => upsert.mutate()}>
            <Plus size={16} aria-hidden="true" />
            {editing ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando actividades" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin actividades de tratamiento. Crea una arriba."
        />
      )}
    </div>
  );
}
