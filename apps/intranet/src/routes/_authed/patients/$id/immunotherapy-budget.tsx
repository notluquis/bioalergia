import {
  Autocomplete,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  EmptyState,
  Input,
  Label,
  ListBox,
  NumberField,
  SearchField,
  Spinner,
  TextField,
  useFilter,
} from "@heroui/react";
import type { Key } from "react";
import type { HideableSection, ProductDto } from "@finanzas/orpc-contracts/immunotherapy";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Download, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createImmunoBudget,
  downloadImmunoBudgetPdf,
  listImmunoAllergens,
  listImmunoProducts,
  quoteImmunotherapy,
} from "@/features/immunotherapy/api";
import { formatCurrency } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

const HIDEABLE: { key: HideableSection; label: string }[] = [
  { key: "intro", label: "Texto introductorio" },
  { key: "allergens", label: "Alérgenos" },
  { key: "concentration", label: "Concentración" },
  { key: "lab", label: "Laboratorio" },
  { key: "prices", label: "Precios (unit./subtotal)" },
  { key: "breakdown", label: "Tabla de dosis" },
  { key: "discount", label: "Descuento" },
  { key: "maintenanceMl", label: "Volumen mantención" },
  { key: "terms", label: "Información y condiciones" },
  { key: "patientRut", label: "RUT del paciente" },
  { key: "signatures", label: "Firmas" },
];

const EMPTY_PRODUCTS: ProductDto[] = [];
const EMPTY_ALLERGENS: { id: string; commonName: string; scientificName: string | null }[] = [];

export const Route = createFileRoute("/_authed/patients/$id/immunotherapy-budget")({
  staticData: {
    permission: { action: "create", subject: "Budget" },
    title: "Presupuesto de Inmunoterapia",
    hideFromNav: true,
  },
  component: ImmunotherapyBudgetPage,
});

function ImmunotherapyBudgetPage() {
  const { id } = Route.useParams();
  const patientId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { contains } = useFilter({ sensitivity: "base" });

  const productsQuery = useQuery({
    queryKey: ["immuno", "products"],
    queryFn: listImmunoProducts,
  });
  const allergensQuery = useQuery({
    queryKey: ["immuno", "allergens"],
    queryFn: () => listImmunoAllergens(),
  });

  const [productId, setProductId] = useState<number | null>(null);
  const [maintenanceMl, setMaintenanceMl] = useState<number | undefined>(undefined);
  const [maintenanceQty, setMaintenanceQty] = useState<number | undefined>(undefined);
  const [discountPct, setDiscountPct] = useState<number | undefined>(undefined);
  const [allergenIds, setAllergenIds] = useState<string[]>([]);
  const [hiddenSections, setHiddenSections] = useState<HideableSection[]>([]);
  const [parentName, setParentName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const selectedProduct = useMemo<ProductDto | undefined>(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  // Al elegir/cambiar producto, precarga los defaults del producto.
  useEffect(() => {
    if (!selectedProduct) return;
    setMaintenanceMl(selectedProduct.maintenanceTargetMl);
    setMaintenanceQty(selectedProduct.maintenanceDefaultQty);
    setDiscountPct(selectedProduct.defaultDiscountPct ?? 0);
  }, [selectedProduct]);

  const quoteInput = useMemo(
    () =>
      productId == null
        ? null
        : {
            productId,
            maintenanceMl,
            maintenanceQty,
            discountPct,
            allergenIds,
            hiddenSections,
          },
    [productId, maintenanceMl, maintenanceQty, discountPct, allergenIds, hiddenSections]
  );

  const quoteQuery = useQuery({
    queryKey: ["immuno", "quote", quoteInput],
    queryFn: () => {
      if (!quoteInput) throw new Error("Selecciona un producto");
      return quoteImmunotherapy(quoteInput);
    },
    enabled: quoteInput != null,
    placeholderData: keepPreviousData,
  });
  const quote = quoteQuery.data;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!quoteInput) throw new Error("Selecciona un producto");
      return createImmunoBudget({
        ...quoteInput,
        patientId,
        parentName: parentName.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Presupuesto creado exitosamente");
      void queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void navigate({ to: "/patients/$id", params: { id: String(id) } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el presupuesto");
    },
  });

  const pdfMutation = useMutation({
    mutationFn: () => {
      if (!quoteInput) throw new Error("Selecciona un producto");
      return downloadImmunoBudgetPdf({
        ...quoteInput,
        patientId,
        parentName: parentName.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el PDF");
    },
  });

  const allergens = allergensQuery.data ?? EMPTY_ALLERGENS;
  const availableAllergens = useMemo(() => {
    const chosen = new Set(allergenIds);
    return allergens
      .filter((a) => !chosen.has(a.id))
      .sort((a, b) => a.commonName.localeCompare(b.commonName));
  }, [allergens, allergenIds]);
  const selectedAllergens = useMemo(
    () =>
      allergenIds
        .map((aid) => allergens.find((a) => a.id === aid))
        .filter((a): a is (typeof allergens)[number] => a != null),
    [allergenIds, allergens]
  );
  const [pickerKey, setPickerKey] = useState(0);

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6">
        <Button
          variant="outline"
          className="gap-2"
          onPress={() => {
            void navigate({ to: "/patients/$id", params: { id: String(id) } });
          }}
        >
          <ChevronLeft size={20} />
          Volver
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Configuración ── */}
        <Card className="space-y-5 p-6">
          <h2 className="font-semibold text-lg">Plan de inmunoterapia</h2>

          {productsQuery.isLoading ? (
            <Spinner aria-label="Cargando productos" />
          ) : products.length === 0 ? (
            <EmptyState>
              No hay productos configurados. Créalos en Configuración → Inmunoterapia.
            </EmptyState>
          ) : (
            <div className="space-y-1">
              <Label>Producto</Label>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={p.id === productId ? "primary" : "outline"}
                    onPress={() => setProductId(p.id)}
                  >
                    {p.name}
                    {p.lab ? ` · ${p.lab}` : ""}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedProduct ? (
            <>
              {selectedProduct.concentrationUtMl != null ? (
                <p className="text-default-500 text-sm">
                  Concentración: {selectedProduct.concentrationUtMl.toLocaleString("es-CL")} UT/mL
                  {selectedProduct.perAllergen ? " por alérgeno" : ""}
                  {selectedProduct.maxAllergens != null
                    ? ` · máx ${selectedProduct.maxAllergens} alérgeno(s)`
                    : ""}
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField value={parentName} onChange={setParentName}>
                  <Label>Apoderado/a (para el texto introductorio)</Label>
                  <Input placeholder="Nombre del apoderado/a" />
                </TextField>
                <TextField value={diagnosis} onChange={setDiagnosis}>
                  <Label>Diagnóstico</Label>
                  <Input placeholder="Ej: rinoconjuntivitis crónica" />
                </TextField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  variant="secondary"
                  minValue={0}
                  step={selectedProduct.maintenanceStepMl || 0.25}
                  value={maintenanceMl ?? selectedProduct.maintenanceTargetMl}
                  onChange={(v) => setMaintenanceMl(v ?? undefined)}
                >
                  <Label>Volumen mantención (mL)</Label>
                  <NumberField.Group>
                    <NumberField.Input />
                  </NumberField.Group>
                </NumberField>

                <NumberField
                  variant="secondary"
                  minValue={0}
                  value={maintenanceQty ?? selectedProduct.maintenanceDefaultQty}
                  onChange={(v) => setMaintenanceQty(v ?? undefined)}
                >
                  <Label>Dosis de mantención</Label>
                  <NumberField.Group>
                    <NumberField.Input />
                  </NumberField.Group>
                </NumberField>

                <NumberField
                  variant="secondary"
                  minValue={0}
                  maxValue={100}
                  value={discountPct ?? 0}
                  onChange={(v) => setDiscountPct(v ?? undefined)}
                >
                  <Label>Descuento (%)</Label>
                  <NumberField.Group>
                    <NumberField.Input />
                  </NumberField.Group>
                </NumberField>
              </div>

              {/* Alérgenos */}
              <div className="space-y-2">
                <Label>Alérgenos incluidos</Label>
                {selectedAllergens.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedAllergens.map((a) => (
                      <Chip key={a.id} variant="secondary" className="gap-1">
                        {a.commonName}
                        <button
                          type="button"
                          aria-label={`Quitar ${a.commonName}`}
                          onClick={() => setAllergenIds((prev) => prev.filter((x) => x !== a.id))}
                        >
                          <X size={14} />
                        </button>
                      </Chip>
                    ))}
                  </div>
                ) : null}
                <Autocomplete
                  aria-label="Agregar alérgeno"
                  className="w-full"
                  key={pickerKey}
                  selectionMode="single"
                  value={null}
                  onChange={(k: Key | Key[] | null) => {
                    const key = Array.isArray(k) ? k[0] : k;
                    const picked = allergens.find((x) => x.id === String(key));
                    const max = selectedProduct?.maxAllergens ?? null;
                    if (picked && !allergenIds.includes(picked.id)) {
                      if (max != null && allergenIds.length >= max) {
                        toast.error(`${selectedProduct?.name} admite máximo ${max} alérgeno(s)`);
                      } else {
                        setAllergenIds((prev) => [...prev, picked.id]);
                        setPickerKey((n) => n + 1);
                      }
                    }
                  }}
                  placeholder="Buscar y agregar alérgeno…"
                >
                  <Autocomplete.Trigger>
                    <Autocomplete.Value />
                    <Autocomplete.ClearButton />
                    <Autocomplete.Indicator />
                  </Autocomplete.Trigger>
                  <Autocomplete.Popover>
                    <Autocomplete.Filter filter={contains}>
                      <SearchField autoFocus name="search" variant="secondary">
                        <SearchField.Group>
                          <SearchField.SearchIcon />
                          <SearchField.Input placeholder="Escribe para buscar…" />
                          <SearchField.ClearButton />
                        </SearchField.Group>
                      </SearchField>
                      <ListBox renderEmptyState={() => <EmptyState>Sin resultados</EmptyState>}>
                        {availableAllergens.map((a) => (
                          <ListBox.Item id={a.id} key={a.id} textValue={a.commonName}>
                            {a.commonName}
                            {a.scientificName ? ` (${a.scientificName})` : ""}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Autocomplete.Filter>
                  </Autocomplete.Popover>
                </Autocomplete>
              </div>

              {/* Ocultar secciones en el PDF */}
              <div className="space-y-2">
                <Label>Ocultar en el PDF</Label>
                <CheckboxGroup
                  aria-label="Secciones a ocultar en el PDF"
                  value={hiddenSections}
                  onChange={(v) => setHiddenSections(v as HideableSection[])}
                  className="grid grid-cols-2 gap-1"
                >
                  {HIDEABLE.map((s) => (
                    <Checkbox key={s.key} value={s.key}>
                      {s.label}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </div>
            </>
          ) : null}
        </Card>

        {/* ── Resumen / preview ── */}
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold text-lg">Resumen del presupuesto</h2>
          {!selectedProduct ? (
            <p className="text-default-500 text-sm">Selecciona un producto para cotizar.</p>
          ) : quoteQuery.isLoading && !quote ? (
            <Spinner aria-label="Calculando" />
          ) : quote ? (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-default-200 border-b text-left text-default-500">
                    <th className="py-1">Concepto</th>
                    <th className="py-1 text-right">Cant.</th>
                    <th className="py-1 text-right">Unitario</th>
                    <th className="py-1 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.stageId ?? line.label} className="border-default-100 border-b">
                      <td className="py-1.5">{line.label}</td>
                      <td className="py-1.5 text-right">{line.quantity}</td>
                      <td className="py-1.5 text-right">{formatCurrency(line.unitPrice)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(line.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discountPct > 0 ? (
                  <div className="flex justify-between text-success">
                    <span>Descuento {quote.discountPct}%</span>
                    <span>- {formatCurrency(quote.discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-default-200 border-t pt-1 font-semibold text-base">
                  <span>Total anual</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="gap-2"
                  isPending={pdfMutation.isPending}
                  onPress={() => pdfMutation.mutate()}
                >
                  <Download size={18} />
                  Generar PDF
                </Button>
                <Button
                  className="gap-2"
                  isPending={saveMutation.isPending}
                  onPress={() => saveMutation.mutate()}
                >
                  <Save size={18} />
                  Guardar presupuesto
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
