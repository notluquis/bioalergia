import {
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Syringe } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";
import { createImmunoAdministration, listImmunoAdministrations } from "../api";
import { immunoKeys } from "../queries";

type AdminItem = Awaited<ReturnType<typeof listImmunoAdministrations>>[number];

// Escala WAO 2024 de reacciones sistémicas (03_REGLAS_CLINICAS §3).
const WAO: Record<number, { label: string; color: "success" | "default" | "warning" | "danger" }> =
  {
    0: { label: "Sin reacción", color: "success" },
    1: { label: "Grado 1 — leve (1 sistema)", color: "default" },
    2: { label: "Grado 2 — moderada (>1 sistema)", color: "warning" },
    3: { label: "Grado 3 — respiratoria / CV", color: "warning" },
    4: { label: "Grado 4 — colapso / shock", color: "danger" },
    5: { label: "Grado 5 — muerte", color: "danger" },
  };

const SITE_LABEL: Record<string, string> = {
  brazo_izquierdo: "Brazo izquierdo",
  brazo_derecho: "Brazo derecho",
};

const columns: ColumnDef<AdminItem>[] = [
  {
    header: "Fecha",
    accessorKey: "administeredAt",
    cell: ({ row }) => (
      <span className="text-sm">
        {formatChile(row.original.administeredAt, "DD/MM/YYYY HH:mm")}
      </span>
    ),
  },
  {
    header: "Dosis",
    accessorKey: "doseLabel",
    cell: ({ row }) => (
      <span className="text-sm">
        {[row.original.doseLabel, row.original.doseMl != null ? `${row.original.doseMl} mL` : null]
          .filter(Boolean)
          .join(" · ") || "—"}
      </span>
    ),
  },
  {
    header: "Sitio",
    accessorKey: "injectionSite",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.injectionSite ? (SITE_LABEL[row.original.injectionSite] ?? "—") : "—"}
      </span>
    ),
  },
  {
    header: "Obs. 30 min",
    accessorKey: "observationCompleted",
    cell: ({ row }) => (
      <Chip
        size="sm"
        variant="soft"
        color={row.original.observationCompleted ? "success" : "warning"}
      >
        {row.original.observationCompleted ? "Completada" : "Pendiente"}
      </Chip>
    ),
  },
  {
    header: "Reacción (WAO)",
    accessorKey: "systemicReactionGrade",
    cell: ({ row }) => {
      const g = row.original.systemicReactionGrade;
      if (g == null) return <span className="text-default-400 text-sm">No evaluada</span>;
      const wao = WAO[g];
      return (
        <Chip size="sm" variant="soft" color={wao?.color ?? "default"}>
          {wao?.label ?? `Grado ${g}`}
        </Chip>
      );
    },
  },
];

export function CarnetInmunoterapia({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: immunoKeys.administrations(patientId),
    queryFn: () => listImmunoAdministrations(patientId),
  });

  const [open, setOpen] = useState(false);
  const [doseLabel, setDoseLabel] = useState("");
  const [doseMl, setDoseMl] = useState("");
  const [vialDescription, setVialDescription] = useState("");
  const [vialLot, setVialLot] = useState("");
  const [injectionSite, setInjectionSite] = useState<"brazo_izquierdo" | "brazo_derecho">(
    "brazo_derecho"
  );
  const [observationCompleted, setObservationCompleted] = useState(false);
  const [hadLocalReaction, setHadLocalReaction] = useState(false);
  const [localReactionNote, setLocalReactionNote] = useState("");
  const [grade, setGrade] = useState<number>(0);
  const [reactionNote, setReactionNote] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setDoseLabel("");
    setDoseMl("");
    setVialDescription("");
    setVialLot("");
    setInjectionSite("brazo_derecho");
    setObservationCompleted(false);
    setHadLocalReaction(false);
    setLocalReactionNote("");
    setGrade(0);
    setReactionNote("");
    setNotes("");
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const ml = doseMl.trim() ? Number(doseMl.replace(",", ".")) : undefined;
      return createImmunoAdministration({
        patientId,
        administeredAt: new Date(),
        doseLabel: doseLabel.trim() || undefined,
        doseMl: ml != null && Number.isFinite(ml) ? ml : undefined,
        vialDescription: vialDescription.trim() || undefined,
        vialLot: vialLot.trim() || undefined,
        injectionSite,
        observationMinutes: 30,
        observationCompleted,
        hadLocalReaction,
        localReactionNote: hadLocalReaction ? localReactionNote.trim() || undefined : undefined,
        systemicReactionGrade: grade,
        reactionNote: grade > 0 ? reactionNote.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Dosis registrada en el carnet");
      void queryClient.invalidateQueries({ queryKey: immunoKeys.administrations(patientId) });
      reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la dosis");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-default-600 text-sm">
          <Syringe size={16} />
          {data?.length ?? 0} dosis registrada(s)
        </div>
        <Button size="sm" variant={open ? "outline" : "primary"} onPress={() => setOpen((v) => !v)}>
          {open ? "Cerrar" : "Registrar dosis"}
        </Button>
      </div>

      {open && (
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField value={doseLabel} onChange={setDoseLabel}>
              <Label>Etapa / dosis</Label>
              <Input placeholder="Ej. Mantención, Inicio dosis 3" />
            </TextField>
            <TextField value={doseMl} onChange={setDoseMl}>
              <Label>Volumen (mL)</Label>
              <Input placeholder="0.5" inputMode="decimal" />
            </TextField>
            <TextField value={vialDescription} onChange={setVialDescription}>
              <Label>Vial / producto</Label>
              <Input placeholder="Ej. Clustek MAX ácaros 10.000 UT" />
            </TextField>
            <TextField value={vialLot} onChange={setVialLot}>
              <Label>Lote</Label>
              <Input placeholder="N° de lote" />
            </TextField>
          </div>

          <RadioGroup
            value={injectionSite}
            onChange={(v) => {
              if (v === "brazo_izquierdo" || v === "brazo_derecho") setInjectionSite(v);
            }}
            orientation="horizontal"
          >
            <Label className="mb-1 font-medium text-sm">Sitio de inyección</Label>
            <div className="flex gap-4">
              <Radio value="brazo_derecho">
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Radio.Content>Brazo derecho</Radio.Content>
              </Radio>
              <Radio value="brazo_izquierdo">
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Radio.Content>Brazo izquierdo</Radio.Content>
              </Radio>
            </div>
          </RadioGroup>

          <Checkbox isSelected={observationCompleted} onChange={setObservationCompleted}>
            Observación 30 min completada (sin incidentes)
          </Checkbox>

          <div className="space-y-2">
            <Label className="font-medium text-sm">Reacción sistémica (escala WAO 2024)</Label>
            <Select
              aria-label="Grado WAO"
              selectedKey={String(grade)}
              onSelectionChange={(k) => setGrade(Number(k))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {Object.entries(WAO).map(([g, { label }]) => (
                    <ListBox.Item id={g} key={g} textValue={label}>
                      {label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            {grade > 0 && (
              <TextField value={reactionNote} onChange={setReactionNote}>
                <Label>Detalle de la reacción sistémica</Label>
                <TextArea rows={2} placeholder="Síntomas, manejo, adrenalina, derivación…" />
              </TextField>
            )}
          </div>

          <Checkbox isSelected={hadLocalReaction} onChange={setHadLocalReaction}>
            Reacción local (pápula / induración)
          </Checkbox>
          {hadLocalReaction && (
            <TextField value={localReactionNote} onChange={setLocalReactionNote}>
              <Label>Detalle reacción local</Label>
              <Input placeholder="Tamaño, manejo…" />
            </TextField>
          )}

          <TextField value={notes} onChange={setNotes}>
            <Label>Notas</Label>
            <TextArea
              rows={2}
              placeholder="Observaciones, premedicación, cambios desde última dosis…"
            />
          </TextField>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button isPending={saveMutation.isPending} onPress={() => saveMutation.mutate()}>
              Guardar dosis
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner label="Cargando carnet" />
        </div>
      ) : (
        <div data-phi-block>
          <DataTable
            columns={columns}
            data={data ?? []}
            enablePagination={false}
            enableToolbar={false}
            noDataMessage="Aún no hay dosis registradas en el carnet de este paciente."
            scrollMaxHeight="min(50dvh, 520px)"
          />
        </div>
      )}
    </div>
  );
}
