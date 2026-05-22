import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ProductDto } from "@finanzas/orpc-contracts/immunotherapy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  createImmunoProduct,
  deleteImmunoProduct,
  getImmunoTerms,
  listImmunoProducts,
  updateImmunoProduct,
  updateImmunoTerms,
} from "@/features/immunotherapy/api";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

export const Route = createFileRoute("/_authed/settings/immunotherapy")({
  staticData: {
    nav: { iconKey: "Syringe", label: "Inmunoterapia (precios)", order: 85, section: "Sistema" },
    permission: { action: "update", subject: "Setting" },
    title: "Configuración — Inmunoterapia",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "Setting")) {
      const routeApi = getRouteApi("/_authed/settings/immunotherapy");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: ImmunotherapySettingsPage,
});

const VACCINE_PRODUCTS = [
  "CLUSTOID",
  "CLUSTOID_FORTE",
  "CLUSTOID_B120",
  "ALXOID",
  "ORAL_TEC",
] as const;

type StageDraft = {
  label: string;
  unitPrice: number;
  defaultQty: number;
  isMaintenance: boolean;
};
type Draft = {
  id: number | null;
  name: string;
  lab: string;
  vaccineProduct: string | null;
  concentrationUtMl: number | null;
  perAllergen: boolean;
  maxAllergens: number | null;
  maintenanceTargetMl: number;
  maintenanceStepMl: number;
  maintenanceDefaultQty: number;
  defaultDiscountPct: number;
  isActive: boolean;
  sortOrder: number;
  stages: StageDraft[];
};

function emptyDraft(): Draft {
  return {
    id: null,
    name: "",
    lab: "",
    vaccineProduct: null,
    concentrationUtMl: null,
    perAllergen: false,
    maxAllergens: null,
    maintenanceTargetMl: 0.5,
    maintenanceStepMl: 0.25,
    maintenanceDefaultQty: 11,
    defaultDiscountPct: 0,
    isActive: true,
    sortOrder: 0,
    stages: [{ label: "Dosis de mantención", unitPrice: 0, defaultQty: 11, isMaintenance: true }],
  };
}

function draftFromProduct(p: ProductDto): Draft {
  return {
    id: p.id,
    name: p.name,
    lab: p.lab ?? "",
    vaccineProduct: p.vaccineProduct,
    concentrationUtMl: p.concentrationUtMl,
    perAllergen: p.perAllergen,
    maxAllergens: p.maxAllergens,
    maintenanceTargetMl: p.maintenanceTargetMl,
    maintenanceStepMl: p.maintenanceStepMl,
    maintenanceDefaultQty: p.maintenanceDefaultQty,
    defaultDiscountPct: p.defaultDiscountPct ?? 0,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    stages: p.stages.map((s) => ({
      label: s.label,
      unitPrice: s.unitPrice,
      defaultQty: s.defaultQty,
      isMaintenance: s.isMaintenance,
    })),
  };
}

function ImmunotherapySettingsPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["immuno", "products"], queryFn: listImmunoProducts });
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["immuno", "products"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: draft.name,
        lab: draft.lab || null,
        vaccineProduct: (draft.vaccineProduct as ProductDto["vaccineProduct"]) ?? null,
        concentrationUtMl: draft.concentrationUtMl,
        perAllergen: draft.perAllergen,
        maxAllergens: draft.maxAllergens,
        maintenanceTargetMl: draft.maintenanceTargetMl,
        maintenanceStepMl: draft.maintenanceStepMl,
        maintenanceDefaultQty: draft.maintenanceDefaultQty,
        defaultDiscountPct: draft.defaultDiscountPct,
        isActive: draft.isActive,
        sortOrder: draft.sortOrder,
        stages: draft.stages.map((s, i) => ({ ...s, sortOrder: i })),
      };
      return draft.id == null
        ? createImmunoProduct(payload)
        : updateImmunoProduct({ id: draft.id, ...payload });
    },
    onSuccess: () => {
      toast.success("Producto guardado");
      void invalidate();
      setDraft(emptyDraft());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteImmunoProduct(id),
    onSuccess: () => {
      toast.success("Producto eliminado");
      void invalidate();
      setDraft(emptyDraft());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const products = productsQuery.data ?? [];

  const updateStage = (idx: number, patch: Partial<StageDraft>) =>
    setDraft((d) => ({
      ...d,
      stages: d.stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));

  return (
    <div className={PAGE_CONTAINER}>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Lista de productos */}
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Productos</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onPress={() => setDraft(emptyDraft())}
            >
              <Plus size={16} /> Nuevo
            </Button>
          </div>
          {productsQuery.isLoading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <div className="space-y-1">
              {products.map((p) => (
                <button
                  type="button"
                  key={`prod-${p.id}`}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-default-100 ${
                    draft.id === p.id ? "bg-default-100 font-medium" : ""
                  }`}
                  onClick={() => setDraft(draftFromProduct(p))}
                >
                  {p.name}
                  {p.lab ? <span className="text-default-500"> · {p.lab}</span> : null}
                  {!p.isActive ? <span className="text-danger"> (inactivo)</span> : null}
                </button>
              ))}
              {products.length === 0 ? (
                <p className="text-default-500 text-sm">Aún no hay productos.</p>
              ) : null}
            </div>
          )}
        </Card>

        {/* Editor */}
        <Card className="space-y-5 p-6">
          <h2 className="font-semibold text-lg">
            {draft.id == null ? "Nuevo producto" : `Editar: ${draft.name}`}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))}>
              <Label>Nombre</Label>
              <Input placeholder="Clustoid" />
            </TextField>
            <TextField value={draft.lab} onChange={(v) => setDraft((d) => ({ ...d, lab: v }))}>
              <Label>Laboratorio</Label>
              <Input placeholder="Roxall" />
            </TextField>

            <div className="space-y-1">
              <Label>Producto clínico (opcional)</Label>
              <Select
                aria-label="Producto clínico"
                selectedKey={draft.vaccineProduct ?? "__none__"}
                onSelectionChange={(k) =>
                  setDraft((d) => ({
                    ...d,
                    vaccineProduct: k === "__none__" ? null : String(k),
                  }))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="__none__" key="__none__">
                      —
                    </ListBox.Item>
                    {VACCINE_PRODUCTS.map((vp) => (
                      <ListBox.Item id={vp} key={vp}>
                        {vp}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <Switch
                isSelected={draft.isActive}
                onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))}
              >
                Activo
              </Switch>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              variant="secondary"
              minValue={0}
              value={draft.concentrationUtMl ?? 0}
              onChange={(v) => setDraft((d) => ({ ...d, concentrationUtMl: v ? v : null }))}
            >
              <Label>Concentración (UT/mL)</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
            <NumberField
              variant="secondary"
              minValue={0}
              value={draft.maxAllergens ?? 0}
              onChange={(v) => setDraft((d) => ({ ...d, maxAllergens: v ? v : null }))}
            >
              <Label>Máx alérgenos (0 = sin límite)</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                isSelected={draft.perAllergen}
                onChange={(v) => setDraft((d) => ({ ...d, perAllergen: v }))}
              >
                Potencia por alérgeno
              </Switch>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              variant="secondary"
              minValue={0}
              value={draft.maintenanceTargetMl}
              onChange={(v) => setDraft((d) => ({ ...d, maintenanceTargetMl: v ?? 0 }))}
            >
              <Label>Volumen mantención (mL)</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
            <NumberField
              variant="secondary"
              minValue={0}
              value={draft.maintenanceStepMl}
              onChange={(v) => setDraft((d) => ({ ...d, maintenanceStepMl: v ?? 0 }))}
            >
              <Label>Tramo de ajuste (mL)</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
            <NumberField
              variant="secondary"
              minValue={0}
              value={draft.maintenanceDefaultQty}
              onChange={(v) => setDraft((d) => ({ ...d, maintenanceDefaultQty: v ?? 0 }))}
            >
              <Label>Dosis mantención/año</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
            <NumberField
              variant="secondary"
              minValue={0}
              maxValue={100}
              value={draft.defaultDiscountPct}
              onChange={(v) => setDraft((d) => ({ ...d, defaultDiscountPct: v ?? 0 }))}
            >
              <Label>Descuento por defecto (%)</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
          </div>

          {/* Etapas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Etapas de dosis</h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    stages: [
                      ...d.stages,
                      { label: "", unitPrice: 0, defaultQty: 1, isMaintenance: false },
                    ],
                  }))
                }
              >
                <Plus size={16} /> Agregar etapa
              </Button>
            </div>

            {draft.stages.map((stage, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-end gap-2 border-default-100 border-b pb-3"
              >
                <div className="col-span-12 sm:col-span-4">
                  <TextField value={stage.label} onChange={(v) => updateStage(idx, { label: v })}>
                    <Label>Concepto</Label>
                    <Input placeholder="Primera dosis" />
                  </TextField>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <NumberField
                    variant="secondary"
                    minValue={0}
                    formatOptions={{
                      style: "currency",
                      currency: "CLP",
                      maximumFractionDigits: 0,
                    }}
                    value={stage.unitPrice}
                    onChange={(v) => updateStage(idx, { unitPrice: v ?? 0 })}
                  >
                    <Label>Precio</Label>
                    <NumberField.Group>
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <NumberField
                    variant="secondary"
                    minValue={1}
                    value={stage.defaultQty}
                    onChange={(v) => updateStage(idx, { defaultQty: v ?? 1 })}
                  >
                    <Label>Cant.</Label>
                    <NumberField.Group>
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Switch
                    isSelected={stage.isMaintenance}
                    onChange={(v) => updateStage(idx, { isMaintenance: v })}
                  >
                    Mant.
                  </Switch>
                </div>
                <div className="col-span-1 flex justify-center pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    isIconOnly
                    className="text-danger"
                    isDisabled={draft.stages.length === 1}
                    onPress={() =>
                      setDraft((d) => ({ ...d, stages: d.stages.filter((_, i) => i !== idx) }))
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            {draft.id != null ? (
              <Button
                variant="outline"
                className="gap-2 text-danger"
                onPress={async () => {
                  const ok = await confirmAction({
                    title: "Eliminar producto",
                    description: `¿Eliminar "${draft.name}" y sus etapas?`,
                    variant: "danger",
                  });
                  if (ok && draft.id != null) deleteMutation.mutate(draft.id);
                }}
              >
                <Trash2 size={18} /> Eliminar
              </Button>
            ) : null}
            <Button
              className="gap-2"
              isPending={saveMutation.isPending}
              isDisabled={!draft.name.trim() || draft.stages.some((s) => !s.label.trim())}
              onPress={() => saveMutation.mutate()}
            >
              <Save size={18} /> Guardar
            </Button>
          </div>
        </Card>
      </div>

      <TermsEditor />
    </div>
  );
}

function TermsEditor() {
  const termsQuery = useQuery({ queryKey: ["immuno", "terms"], queryFn: getImmunoTerms });
  const [legalName, setLegalName] = useState<string | null>(null);
  const [legalRut, setLegalRut] = useState<string | null>(null);
  const [terms, setTerms] = useState<string | null>(null);
  const [intro, setIntro] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (termsQuery.data && !loaded) {
    setLegalName(termsQuery.data.legalName);
    setLegalRut(termsQuery.data.legalRut);
    setTerms(termsQuery.data.immunoBudgetTerms);
    setIntro(termsQuery.data.immunoBudgetIntro);
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () =>
      updateImmunoTerms({
        legalName,
        legalRut,
        immunoBudgetTerms: terms,
        immunoBudgetIntro: intro,
      }),
    onSuccess: () => toast.success("Condiciones guardadas"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  return (
    <Card className="mt-6 space-y-4 p-6">
      <h2 className="font-semibold text-lg">Prestador y condiciones económicas (PDF)</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField value={legalName ?? ""} onChange={(v) => setLegalName(v)}>
          <Label>Razón social (prestador)</Label>
          <Input placeholder="DR. ... Y COMPAÑÍA LIMITADA" />
        </TextField>
        <TextField value={legalRut ?? ""} onChange={(v) => setLegalRut(v)}>
          <Label>RUT prestador</Label>
          <Input placeholder="76.406.172-1" />
        </TextField>
      </div>
      <TextField value={intro ?? ""} onChange={(v) => setIntro(v)}>
        <Label>
          Texto introductorio (arriba del presupuesto) — placeholders {"{{paciente}}"}{" "}
          {"{{apoderado}}"} {"{{diagnostico}}"}
        </Label>
        <TextArea rows={10} placeholder="Estimado/a {{apoderado}}: …" />
      </TextField>
      <TextField value={terms ?? ""} onChange={(v) => setTerms(v)}>
        <Label>Información importante y condiciones (se imprimen al pie del presupuesto)</Label>
        <TextArea
          rows={12}
          placeholder="Riesgos, observación, alternativas, duración, condiciones económicas…"
        />
      </TextField>
      <div className="flex justify-end">
        <Button className="gap-2" isPending={save.isPending} onPress={() => save.mutate()}>
          <Save size={18} /> Guardar condiciones
        </Button>
      </div>
    </Card>
  );
}
