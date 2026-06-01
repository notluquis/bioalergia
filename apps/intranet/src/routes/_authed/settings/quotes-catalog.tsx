import { Button, Card, Input, Label, NumberField, Spinner, Switch, TextField } from "@heroui/react";
import type { QuoteProductDto } from "@finanzas/orpc-contracts/quotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  createQuoteProduct,
  deleteQuoteProduct,
  listQuoteProducts,
  quotesKeys,
  updateQuoteProduct,
} from "@/features/quotes/api";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

export const Route = createFileRoute("/_authed/settings/quotes-catalog")({
  staticData: {
    nav: {
      iconKey: "FileSpreadsheet",
      label: "Cotizaciones (catálogo)",
      order: 86,
      section: "Sistema",
    },
    permission: { action: "update", subject: "QuoteProduct" },
    title: "Configuración — Catálogo de cotizaciones",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "QuoteProduct")) {
      const routeApi = getRouteApi("/_authed/settings/quotes-catalog");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: QuotesCatalogSettingsPage,
});

type Draft = {
  id: number | null;
  code: string;
  brand: string;
  category: string;
  name: string;
  format: string;
  unitPrice: number;
  isActive: boolean;
  sortOrder: number;
};

function emptyDraft(): Draft {
  return {
    id: null,
    code: "",
    brand: "",
    category: "",
    name: "",
    format: "",
    unitPrice: 0,
    isActive: true,
    sortOrder: 0,
  };
}

function draftFrom(p: QuoteProductDto): Draft {
  return {
    id: p.id,
    code: p.code ?? "",
    brand: p.brand ?? "",
    category: p.category ?? "",
    name: p.name,
    format: p.format ?? "",
    unitPrice: p.unitPrice,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  };
}

function QuotesCatalogSettingsPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: quotesKeys.products(), queryFn: listQuoteProducts });
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: quotesKeys.products() });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: draft.code.trim() || null,
        brand: draft.brand.trim() || null,
        category: draft.category.trim() || null,
        name: draft.name.trim(),
        format: draft.format.trim() || null,
        unitPrice: draft.unitPrice,
        isActive: draft.isActive,
        sortOrder: draft.sortOrder,
      };
      return draft.id == null
        ? createQuoteProduct(payload)
        : updateQuoteProduct({ id: draft.id, ...payload });
    },
    onSuccess: () => {
      toast.success("Producto guardado");
      void invalidate();
      setDraft(emptyDraft());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteQuoteProduct(id),
    onSuccess: () => {
      toast.success("Producto eliminado");
      void invalidate();
      setDraft(emptyDraft());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const products = productsQuery.data ?? [];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
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
                  key={`qp-${p.id}`}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-default-100 ${
                    draft.id === p.id ? "bg-default-100 font-medium" : ""
                  }`}
                  onClick={() => setDraft(draftFrom(p))}
                >
                  {p.code ? <span className="text-default-500">{p.code} · </span> : null}
                  {p.name}
                  {p.format ? <span className="text-default-500"> ({p.format})</span> : null}
                  {!p.isActive ? <span className="text-danger"> (inactivo)</span> : null}
                </button>
              ))}
              {products.length === 0 ? (
                <p className="text-default-500 text-sm">Aún no hay productos.</p>
              ) : null}
            </div>
          )}
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="font-semibold text-lg">
            {draft.id == null ? "Nuevo producto" : `Editar: ${draft.name}`}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField value={draft.code} onChange={(v) => setDraft((d) => ({ ...d, code: v }))}>
              <Label>Código</Label>
              <Input placeholder="E802" />
            </TextField>
            <TextField
              value={draft.format}
              onChange={(v) => setDraft((d) => ({ ...d, format: v }))}
            >
              <Label>Formato</Label>
              <Input placeholder="2.5 mL" />
            </TextField>
            <TextField value={draft.brand} onChange={(v) => setDraft((d) => ({ ...d, brand: v }))}>
              <Label>Marca</Label>
              <Input placeholder="DIATER" />
            </TextField>
            <TextField
              value={draft.category}
              onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            >
              <Label>Categoría</Label>
              <Input placeholder="Gramínea" />
            </TextField>
            <TextField
              className="sm:col-span-2"
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              isRequired
            >
              <Label>Detalle / Alérgeno</Label>
              <Input placeholder="Cynodon dactylon / Pasto bermuda" />
            </TextField>
            <NumberField
              variant="secondary"
              minValue={0}
              formatOptions={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }}
              value={draft.unitPrice}
              onChange={(v) => setDraft((d) => ({ ...d, unitPrice: v ?? 0 }))}
            >
              <Label>Precio unitario</Label>
              <NumberField.Group className="grid-cols-1">
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                isSelected={draft.isActive}
                onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))}
              >
                Activo
              </Switch>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            {draft.id != null ? (
              <Button
                variant="outline"
                className="gap-2 text-danger"
                onPress={async () => {
                  const ok = await confirmAction({
                    title: "Eliminar producto",
                    description: `¿Eliminar "${draft.name}"?`,
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
              isDisabled={!draft.name.trim()}
              onPress={() => saveMutation.mutate()}
            >
              <Save size={18} /> Guardar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
