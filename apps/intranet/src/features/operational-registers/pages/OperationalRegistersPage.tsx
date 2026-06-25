import {
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import type {
  CreateOperationalRegisterInput,
  NonconformityStatus,
  OperationalRegisterDto,
  RegisterType,
} from "@finanzas/orpc-contracts/operational-registers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  operationalRegistersORPCClient,
  toOperationalRegistersApiError,
} from "@/features/operational-registers/orpc";
import { civilNoon, formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const BASE_KEY = ["operational-registers"] as const;
const keyFor = (t: RegisterType) => [...BASE_KEY, t] as const;

const TYPE_LABEL: Record<RegisterType, string> = {
  COLD_CHAIN: "Cadena de frío",
  REAS: "REAS",
  TRAINING: "Capacitaciones",
  EPP_DELIVERY: "Entrega EPP",
  OMPP: "OMPP",
  R_AIT: "R-AIT",
  NONCONFORMITY: "No conformidades",
};

const TYPE_ORDER: RegisterType[] = [
  "COLD_CHAIN",
  "REAS",
  "TRAINING",
  "EPP_DELIVERY",
  "OMPP",
  "R_AIT",
  "NONCONFORMITY",
];

const STATUS_LABEL: Record<NonconformityStatus, string> = {
  OPEN: "Abierta",
  IN_PROGRESS: "En proceso",
  CLOSED: "Cerrada",
};

const STATUS_COLOR: Record<NonconformityStatus, "default" | "warning" | "success"> = {
  OPEN: "warning",
  IN_PROGRESS: "default",
  CLOSED: "success",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getField(r: OperationalRegisterDto, key: string): string {
  const v = r.data[key];
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function isOverdue(r: OperationalRegisterDto): boolean {
  return r.status !== "CLOSED" && r.dueAt !== null && new Date(r.dueAt).getTime() < Date.now();
}

export function OperationalRegistersPage() {
  const [activeType, setActiveType] = useState<RegisterType>("COLD_CHAIN");

  return (
    <Page>
      <PageHeader
        title="Registros operativos"
        description="Registros sanitarios y operativos exigibles por la SEREMI (DS 283, BIO-RG-001, REAS DS 6/2009, DS 44/2024): cadena de frío, REAS, capacitaciones, entrega de EPP, OMPP, R-AIT y no conformidades."
        icon={<ClipboardList size={22} />}
      />

      <Tabs
        aria-label="Tipos de registro"
        selectedKey={activeType}
        onSelectionChange={(k) => setActiveType(String(k) as RegisterType)}
      >
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Tipos de registro"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            {TYPE_ORDER.map((t) => (
              <Tabs.Tab key={t} id={t}>
                {TYPE_LABEL[t]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {TYPE_ORDER.map((t) => (
          <Tabs.Panel key={t} id={t} className="pt-4">
            {activeType === t ? <RegisterTypePanel registerType={t} /> : null}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Page>
  );
}

function RegisterTypePanel({ registerType }: { registerType: RegisterType }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: keyFor(registerType),
    queryFn: async () => {
      try {
        const res = await operationalRegistersORPCClient.list({ registerType });
        return res.registers;
      } catch (error) {
        throw toOperationalRegistersApiError(error);
      }
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: keyFor(registerType) });

  const columns = buildColumns(registerType, {
    onChanged: () => void invalidate(),
  });

  return (
    <div className="space-y-6">
      <NewRegisterForm registerType={registerType} onCreated={() => void invalidate()} />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando registros" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin registros."
        />
      )}
    </div>
  );
}

function buildColumns(
  registerType: RegisterType,
  opts: { onChanged: () => void }
): ColumnDef<OperationalRegisterDto>[] {
  const occurred: ColumnDef<OperationalRegisterDto> = {
    header: "Fecha",
    accessorKey: "occurredAt",
    cell: ({ row }) => (
      <span className="text-sm">{formatChile(row.original.occurredAt, "DD/MM/YYYY")}</span>
    ),
  };
  const summary: ColumnDef<OperationalRegisterDto> = {
    header: "Resumen",
    accessorKey: "summary",
    cell: ({ row }) => <span className="text-sm">{row.original.summary}</span>,
  };

  if (registerType === "NONCONFORMITY") {
    return [
      occurred,
      summary,
      {
        header: "Estado",
        accessorKey: "status",
        cell: ({ row }) => {
          const s = (row.original.status ?? "OPEN") as NonconformityStatus;
          return (
            <Chip size="sm" variant="soft" color={STATUS_COLOR[s]}>
              {STATUS_LABEL[s]}
            </Chip>
          );
        },
      },
      {
        header: "Plazo CAPA",
        accessorKey: "dueAt",
        cell: ({ row }) => {
          if (!row.original.dueAt) return <span className="text-default-400 text-sm">—</span>;
          const overdue = isOverdue(row.original);
          return (
            <span className={overdue ? "font-semibold text-danger text-sm" : "text-sm"}>
              {formatChile(row.original.dueAt, "DD/MM/YYYY")}
              {overdue ? " (vencido)" : ""}
            </span>
          );
        },
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) =>
          row.original.status !== "CLOSED" ? (
            <CloseNonconformityCell register={row.original} onChanged={opts.onChanged} />
          ) : null,
      },
    ];
  }

  return [occurred, summary, ...detailColumns(registerType)];
}

function detailColumns(registerType: RegisterType): ColumnDef<OperationalRegisterDto>[] {
  const col = (header: string, key: string): ColumnDef<OperationalRegisterDto> => ({
    header,
    id: key,
    cell: ({ row }) => <span className="text-sm">{getField(row.original, key) || "—"}</span>,
  });
  // signedBy lives at the top level of the row (not in `data`).
  const signedCol = (header: string): ColumnDef<OperationalRegisterDto> => ({
    header,
    id: "signedBy",
    cell: ({ row }) => <span className="text-sm">{row.original.signedBy || "—"}</span>,
  });

  switch (registerType) {
    case "COLD_CHAIN":
      return [col("Temp (°C)", "tempC"), col("Acción correctiva", "correctiveAction")];
    case "REAS":
      return [col("Residuo", "wasteType"), col("Kg", "quantityKg"), col("Destino", "destination")];
    case "TRAINING":
      return [col("Facilitador", "facilitator"), col("Asistentes", "attendees")];
    case "EPP_DELIVERY":
      return [col("Receptor", "recipient"), col("Cantidad", "quantity"), signedCol("Firma")];
    case "OMPP":
      return [col("Delegado a", "delegatedTo"), signedCol("Firma director")];
    case "R_AIT":
      return [col("Alérgeno", "allergen"), col("Dosis", "dose"), col("Reacción", "reaction")];
    default:
      return [];
  }
}

function CloseNonconformityCell({
  register,
  onChanged,
}: {
  register: OperationalRegisterDto;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<NonconformityStatus>("IN_PROGRESS");
  const [resolution, setResolution] = useState("");

  const mutate = useMutation({
    mutationFn: async () => {
      try {
        return await operationalRegistersORPCClient.closeNonconformity({
          id: register.id,
          status,
          resolution: resolution.trim() || undefined,
        });
      } catch (error) {
        throw toOperationalRegistersApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("No conformidad actualizada");
      setOpen(false);
      setResolution("");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onPress={() => setOpen(true)}>
          Cerrar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Select
        aria-label="Nuevo estado"
        selectedKey={status}
        onSelectionChange={(k) => setStatus(String(k) as NonconformityStatus)}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {(["IN_PROGRESS", "CLOSED"] as NonconformityStatus[]).map((s) => (
              <ListBox.Item key={s} id={s} textValue={STATUS_LABEL[s]}>
                {STATUS_LABEL[s]}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <TextField className="w-full" value={resolution} onChange={setResolution}>
        <Label>Resolución (opcional)</Label>
        <Input placeholder="Acción / cierre" />
      </TextField>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onPress={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button size="sm" isPending={mutate.isPending} onPress={() => mutate.mutate()}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formularios por tipo
// ---------------------------------------------------------------------------

type FormState = {
  occurredAt: string;
  notes: string;
  // COLD_CHAIN
  tempC: number;
  minC: number;
  maxC: number;
  withinRange: boolean;
  correctiveAction: string;
  // REAS
  movement: "INGRESO" | "RETIRO";
  wasteType: string;
  quantityKg: number;
  destination: string;
  guideNumber: string;
  // TRAINING
  topic: string;
  facilitator: string;
  attendees: string;
  durationHours: number;
  // EPP_DELIVERY
  item: string;
  recipient: string;
  quantity: number;
  // OMPP
  procedure: string;
  delegatedTo: string;
  validUntil: string;
  // shared signedBy (EPP / OMPP)
  signedBy: string;
  // R_AIT
  patientRef: string;
  allergen: string;
  dose: string;
  reaction: string;
  observationMin: number;
  // NONCONFORMITY
  description: string;
  rootCause: string;
  action: string;
  responsible: string;
  dueAt: string;
};

function emptyForm(): FormState {
  return {
    occurredAt: todayISO(),
    notes: "",
    tempC: 5,
    minC: 2,
    maxC: 8,
    withinRange: true,
    correctiveAction: "",
    movement: "RETIRO",
    wasteType: "",
    quantityKg: 0,
    destination: "",
    guideNumber: "",
    topic: "",
    facilitator: "",
    attendees: "",
    durationHours: 1,
    item: "",
    recipient: "",
    quantity: 1,
    procedure: "",
    delegatedTo: "",
    validUntil: "",
    signedBy: "",
    patientRef: "",
    allergen: "",
    dose: "",
    reaction: "",
    observationMin: 30,
    description: "",
    rootCause: "",
    action: "",
    responsible: "",
    dueAt: "",
  };
}

function buildPayload(
  registerType: RegisterType,
  f: FormState
): CreateOperationalRegisterInput | { error: string } {
  const occurredAt = civilNoon(f.occurredAt).toISOString();
  const notes = f.notes.trim() || undefined;

  switch (registerType) {
    case "COLD_CHAIN":
      return {
        registerType,
        occurredAt,
        notes,
        tempC: f.tempC,
        minC: f.minC,
        maxC: f.maxC,
        withinRange: f.withinRange,
        correctiveAction: f.correctiveAction.trim() || undefined,
      };
    case "REAS":
      if (!f.wasteType.trim()) return { error: "Indica el tipo de residuo" };
      return {
        registerType,
        occurredAt,
        notes,
        movement: f.movement,
        wasteType: f.wasteType.trim(),
        quantityKg: f.quantityKg,
        destination: f.destination.trim() || undefined,
        guideNumber: f.guideNumber.trim() || undefined,
      };
    case "TRAINING": {
      if (!f.topic.trim()) return { error: "Indica el tema" };
      const attendees = f.attendees
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        registerType,
        occurredAt,
        notes,
        topic: f.topic.trim(),
        facilitator: f.facilitator.trim() || undefined,
        attendees,
        durationHours: f.durationHours || undefined,
      };
    }
    case "EPP_DELIVERY":
      if (!f.item.trim()) return { error: "Indica el ítem" };
      if (!f.recipient.trim()) return { error: "Indica el receptor" };
      return {
        registerType,
        occurredAt,
        notes,
        item: f.item.trim(),
        recipient: f.recipient.trim(),
        quantity: Math.round(f.quantity),
        signedBy: f.signedBy.trim() || undefined,
      };
    case "OMPP":
      if (!f.procedure.trim()) return { error: "Indica el procedimiento" };
      if (!f.delegatedTo.trim()) return { error: "Indica a quién se delega" };
      return {
        registerType,
        occurredAt,
        notes,
        procedure: f.procedure.trim(),
        delegatedTo: f.delegatedTo.trim(),
        validUntil: f.validUntil ? civilNoon(f.validUntil).toISOString() : undefined,
        signedBy: f.signedBy.trim() || undefined,
      };
    case "R_AIT":
      if (!f.patientRef.trim()) return { error: "Indica la referencia del paciente" };
      if (!f.allergen.trim()) return { error: "Indica el alérgeno" };
      if (!f.dose.trim()) return { error: "Indica la dosis" };
      return {
        registerType,
        occurredAt,
        notes,
        patientRef: f.patientRef.trim(),
        allergen: f.allergen.trim(),
        dose: f.dose.trim(),
        reaction: f.reaction.trim() || undefined,
        observationMin: f.observationMin || undefined,
      };
    case "NONCONFORMITY":
      if (!f.description.trim()) return { error: "Describe la no conformidad" };
      return {
        registerType,
        occurredAt,
        notes,
        description: f.description.trim(),
        rootCause: f.rootCause.trim() || undefined,
        action: f.action.trim() || undefined,
        responsible: f.responsible.trim() || undefined,
        dueAt: f.dueAt ? civilNoon(f.dueAt).toISOString() : undefined,
      };
  }
}

function NewRegisterForm({
  registerType,
  onCreated,
}: {
  registerType: RegisterType;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const create = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(registerType, form);
      if ("error" in payload) throw new Error(payload.error);
      try {
        return await operationalRegistersORPCClient.create(payload);
      } catch (error) {
        throw toOperationalRegistersApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Registro creado");
      setForm(emptyForm());
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear el registro"),
  });

  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold text-base">Nuevo registro — {TYPE_LABEL[registerType]}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AppDatePicker
          label="Fecha"
          onChange={(v) => set("occurredAt", v)}
          value={form.occurredAt}
        />

        {registerType === "COLD_CHAIN" && (
          <>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Temperatura (°C)</Label>
              <NumberField value={form.tempC} onChange={(v) => set("tempC", v ?? 0)} step={0.1}>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Mín (°C)</Label>
              <NumberField value={form.minC} onChange={(v) => set("minC", v ?? 0)} step={0.1}>
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
            </div>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Máx (°C)</Label>
              <NumberField value={form.maxC} onChange={(v) => set("maxC", v ?? 0)} step={0.1}>
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
            </div>
            <div className="flex items-center">
              <Checkbox isSelected={form.withinRange} onChange={(v) => set("withinRange", v)}>
                Dentro de rango
              </Checkbox>
            </div>
            <TextField
              className="lg:col-span-2"
              value={form.correctiveAction}
              onChange={(v) => set("correctiveAction", v)}
            >
              <Label>Acción correctiva (opcional)</Label>
              <Input placeholder="Si está fuera de rango" />
            </TextField>
          </>
        )}

        {registerType === "REAS" && (
          <>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Movimiento</Label>
              <Select
                aria-label="Movimiento"
                selectedKey={form.movement}
                onSelectionChange={(k) => set("movement", String(k) as "INGRESO" | "RETIRO")}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="INGRESO" textValue="Ingreso">
                      Ingreso
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="RETIRO" textValue="Retiro">
                      Retiro
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <TextField value={form.wasteType} onChange={(v) => set("wasteType", v)}>
              <Label>Tipo de residuo</Label>
              <Input placeholder="ej. CORTOPUNZANTE" />
            </TextField>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Cantidad (kg)</Label>
              <NumberField
                value={form.quantityKg}
                onChange={(v) => set("quantityKg", v ?? 0)}
                minValue={0}
                step={0.1}
              >
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
            </div>
            <TextField value={form.destination} onChange={(v) => set("destination", v)}>
              <Label>Destino (opcional)</Label>
              <Input placeholder="ej. Retmedical" />
            </TextField>
            <TextField value={form.guideNumber} onChange={(v) => set("guideNumber", v)}>
              <Label>N° de guía (opcional)</Label>
              <Input />
            </TextField>
          </>
        )}

        {registerType === "TRAINING" && (
          <>
            <TextField value={form.topic} onChange={(v) => set("topic", v)}>
              <Label>Tema</Label>
              <Input placeholder="ej. Manejo de REAS" />
            </TextField>
            <TextField value={form.facilitator} onChange={(v) => set("facilitator", v)}>
              <Label>Facilitador (opcional)</Label>
              <Input />
            </TextField>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Duración (horas, opcional)</Label>
              <NumberField
                value={form.durationHours}
                onChange={(v) => set("durationHours", v ?? 0)}
                minValue={0}
                step={0.5}
              >
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
            </div>
            <TextField
              className="lg:col-span-3"
              value={form.attendees}
              onChange={(v) => set("attendees", v)}
            >
              <Label>Asistentes (uno por línea o separados por coma)</Label>
              <TextArea rows={3} placeholder="Nombre 1, Nombre 2…" />
            </TextField>
          </>
        )}

        {registerType === "EPP_DELIVERY" && (
          <>
            <TextField value={form.item} onChange={(v) => set("item", v)}>
              <Label>Ítem EPP</Label>
              <Input placeholder="ej. Guantes nitrilo" />
            </TextField>
            <TextField value={form.recipient} onChange={(v) => set("recipient", v)}>
              <Label>Receptor</Label>
              <Input placeholder="Nombre del trabajador" />
            </TextField>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Cantidad</Label>
              <NumberField
                value={form.quantity}
                onChange={(v) => set("quantity", v ?? 0)}
                minValue={1}
                step={1}
              >
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>
            <TextField value={form.signedBy} onChange={(v) => set("signedBy", v)}>
              <Label>Firma del receptor (opcional)</Label>
              <Input />
            </TextField>
          </>
        )}

        {registerType === "OMPP" && (
          <>
            <TextField value={form.procedure} onChange={(v) => set("procedure", v)}>
              <Label>Procedimiento delegado</Label>
              <Input placeholder="ej. Aplicación de inmunoterapia" />
            </TextField>
            <TextField value={form.delegatedTo} onChange={(v) => set("delegatedTo", v)}>
              <Label>Delegado a</Label>
              <Input placeholder="Nombre del profesional" />
            </TextField>
            <AppDatePicker
              label="Válido hasta (opcional)"
              onChange={(v) => set("validUntil", v)}
              value={form.validUntil}
            />
            <TextField value={form.signedBy} onChange={(v) => set("signedBy", v)}>
              <Label>Firma del director (opcional)</Label>
              <Input />
            </TextField>
          </>
        )}

        {registerType === "R_AIT" && (
          <>
            <TextField value={form.patientRef} onChange={(v) => set("patientRef", v)}>
              <Label>Referencia del paciente</Label>
              <Input placeholder="RUT o ficha" />
            </TextField>
            <TextField value={form.allergen} onChange={(v) => set("allergen", v)}>
              <Label>Alérgeno</Label>
              <Input />
            </TextField>
            <TextField value={form.dose} onChange={(v) => set("dose", v)}>
              <Label>Dosis</Label>
              <Input placeholder="ej. 0.5 mL 1:100" />
            </TextField>
            <TextField value={form.reaction} onChange={(v) => set("reaction", v)}>
              <Label>Reacción (opcional)</Label>
              <Input placeholder="ej. Eritema local" />
            </TextField>
            <div className="space-y-1">
              <Label className="font-medium text-sm">Observación (min, opcional)</Label>
              <NumberField
                value={form.observationMin}
                onChange={(v) => set("observationMin", v ?? 0)}
                minValue={0}
                step={5}
              >
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
            </div>
          </>
        )}

        {registerType === "NONCONFORMITY" && (
          <>
            <TextField
              className="lg:col-span-3"
              value={form.description}
              onChange={(v) => set("description", v)}
            >
              <Label>Descripción</Label>
              <TextArea rows={2} placeholder="Describe la no conformidad detectada" />
            </TextField>
            <TextField value={form.rootCause} onChange={(v) => set("rootCause", v)}>
              <Label>Causa raíz (opcional)</Label>
              <Input />
            </TextField>
            <TextField value={form.action} onChange={(v) => set("action", v)}>
              <Label>Acción correctiva (opcional)</Label>
              <Input />
            </TextField>
            <TextField value={form.responsible} onChange={(v) => set("responsible", v)}>
              <Label>Responsable (opcional)</Label>
              <Input />
            </TextField>
            <AppDatePicker
              label="Plazo CAPA (opcional)"
              onChange={(v) => set("dueAt", v)}
              value={form.dueAt}
            />
          </>
        )}

        <TextField className="lg:col-span-3" value={form.notes} onChange={(v) => set("notes", v)}>
          <Label>Notas (opcional)</Label>
          <Input placeholder="Observaciones adicionales" />
        </TextField>
      </div>
      <div className="flex justify-end">
        <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
          <Plus size={16} aria-hidden="true" />
          Nuevo registro
        </Button>
      </div>
    </Card>
  );
}
