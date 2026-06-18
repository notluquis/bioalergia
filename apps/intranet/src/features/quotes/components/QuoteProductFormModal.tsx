import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  ScrollShadow,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type { QuoteProductDto } from "@finanzas/orpc-contracts/quotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  createQuoteProduct,
  deleteQuoteProduct,
  quotesKeys,
  updateQuoteProduct,
} from "@/features/quotes/api";
import { allergensKeys, listAllergens } from "@/features/allergens/api";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast-interceptor";

type Draft = {
  code: string;
  format: string;
  brand: string;
  category: string;
  name: string;
  unitPrice: number;
  isActive: boolean;
  publishedOnSite: boolean;
  slug: string;
  imageUrl: string;
  description: string;
  seoDescription: string;
  allergenId: string | null;
};

function draftFrom(p?: QuoteProductDto): Draft {
  return {
    code: p?.code ?? "",
    format: p?.format ?? "",
    brand: p?.brand ?? "",
    category: p?.category ?? "",
    name: p?.name ?? "",
    unitPrice: p?.unitPrice ?? 0,
    isActive: p?.isActive ?? true,
    publishedOnSite: p?.publishedOnSite ?? false,
    slug: p?.slug ?? "",
    imageUrl: p?.imageUrl ?? "",
    description: p?.description ?? "",
    seoDescription: p?.seoDescription ?? "",
    allergenId: p?.allergenId ?? null,
  };
}

type QuoteProductFormModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product?: QuoteProductDto;
};

export function QuoteProductFormModal({
  isOpen,
  onOpenChange,
  product,
}: QuoteProductFormModalProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(product));
  const [loadedFor, setLoadedFor] = useState<number | null>(product?.id ?? null);

  // Re-hidratar al cambiar el producto objetivo o reabrir en limpio.
  const targetId = product?.id ?? null;
  if (isOpen && loadedFor !== targetId) {
    setDraft(draftFrom(product));
    setLoadedFor(targetId);
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const allergensQuery = useQuery({
    queryKey: allergensKeys.list({}),
    queryFn: () => listAllergens(),
  });
  const allergens = allergensQuery.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: quotesKeys.products() });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: draft.code.trim() || null,
        format: draft.format.trim() || null,
        brand: draft.brand.trim() || null,
        category: draft.category.trim() || null,
        name: draft.name.trim(),
        unitPrice: draft.unitPrice,
        isActive: draft.isActive,
        sortOrder: product?.sortOrder ?? 0,
        publishedOnSite: draft.publishedOnSite,
        slug: draft.slug.trim() || null,
        imageUrl: draft.imageUrl.trim() || null,
        description: draft.description.trim() || null,
        seoDescription: draft.seoDescription.trim() || null,
        allergenId: draft.allergenId,
      };
      return product
        ? updateQuoteProduct({ id: product.id, ...payload })
        : createQuoteProduct(payload);
    },
    onSuccess: () => {
      toast.success(product ? "Producto actualizado" : "Producto creado");
      void invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("Sin producto");
      return deleteQuoteProduct(product.id);
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      void invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={product ? "Editar producto" : "Nuevo producto"}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{product ? "Editar producto" : "Nuevo producto"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField value={draft.code} onChange={(v) => set("code", v)}>
                <Label>Código</Label>
                <Input placeholder="E802" />
              </TextField>
              <TextField value={draft.format} onChange={(v) => set("format", v)}>
                <Label>Formato</Label>
                <Input placeholder="2.5 mL" />
              </TextField>
              <TextField value={draft.brand} onChange={(v) => set("brand", v)}>
                <Label>Marca</Label>
                <Input placeholder="DIATER" />
              </TextField>
              <TextField value={draft.category} onChange={(v) => set("category", v)}>
                <Label>Categoría</Label>
                <Input placeholder="Gramínea" />
              </TextField>
              <TextField
                className="sm:col-span-2"
                value={draft.name}
                onChange={(v) => set("name", v)}
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
                onChange={(v) => set("unitPrice", v ?? 0)}
              >
                <Label>Precio unitario</Label>
                <NumberField.Group className="grid-cols-1">
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
              <div className="flex items-center gap-2 pt-6">
                <Switch isSelected={draft.isActive} onChange={(v) => set("isActive", v)}>
                  Activo
                </Switch>
              </div>

              {/* ── Vitrina /venta-empresas ──────────────────────────── */}
              <div className="mt-2 border-default-200 border-t pt-4 sm:col-span-2">
                <h3 className="mb-3 font-medium text-default-700 text-sm">Vitrina pública</h3>
                <Switch
                  isSelected={draft.publishedOnSite}
                  onChange={(v) => set("publishedOnSite", v)}
                >
                  Publicar en vitrina /venta-empresas
                </Switch>
              </div>

              <TextField value={draft.slug} onChange={(v) => set("slug", v)}>
                <Label>Slug</Label>
                <Input placeholder="cynodon-dactylon" />
              </TextField>
              <TextField value={draft.imageUrl} onChange={(v) => set("imageUrl", v)}>
                <Label>URL de imagen</Label>
                <Input placeholder="https://…" type="url" />
              </TextField>

              <TextField
                className="sm:col-span-2"
                value={draft.description}
                onChange={(v) => set("description", v)}
              >
                <Label>Descripción</Label>
                <TextArea rows={3} placeholder="Descripción del reactivo para la vitrina…" />
              </TextField>

              <TextField
                className="sm:col-span-2"
                value={draft.seoDescription}
                onChange={(v) => set("seoDescription", v)}
              >
                <Label>Descripción SEO</Label>
                <Input placeholder="Meta description para buscadores" />
              </TextField>

              <ComboBox
                allowsEmptyCollection
                className="sm:col-span-2"
                selectedKey={draft.allergenId}
                onSelectionChange={(key) => set("allergenId", key === null ? null : String(key))}
              >
                <Label>Alérgeno asociado</Label>
                <ComboBox.InputGroup>
                  <Input placeholder="Buscar alérgeno…" />
                  <ComboBox.Trigger />
                </ComboBox.InputGroup>
                <ComboBox.Popover>
                  <ScrollShadow className="max-h-72" hideScrollBar>
                    <ListBox className="overflow-y-auto">
                      {allergens.map((a) => {
                        const label = a.scientificName
                          ? `${a.commonName} (${a.scientificName})`
                          : a.commonName;
                        return (
                          <ListBox.Item id={a.id} key={a.id} textValue={label}>
                            {label}
                            <ListBox.ItemIndicator>
                              {({ isSelected }) =>
                                isSelected ? <Check className="size-4 text-primary" /> : null
                              }
                            </ListBox.ItemIndicator>
                          </ListBox.Item>
                        );
                      })}
                    </ListBox>
                  </ScrollShadow>
                </ComboBox.Popover>
              </ComboBox>
            </div>
          </Modal.Body>
          <Modal.Footer>
            {product ? (
              <Button
                variant="outline"
                className="mr-auto gap-2 text-danger"
                onPress={async () => {
                  const ok = await confirmAction({
                    title: "Eliminar producto",
                    description: `¿Eliminar "${product.name}"?`,
                    variant: "danger",
                  });
                  if (ok) deleteMutation.mutate();
                }}
              >
                <Trash2 size={18} /> Eliminar
              </Button>
            ) : null}
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button
              isPending={saveMutation.isPending}
              isDisabled={!draft.name.trim()}
              onPress={() => saveMutation.mutate()}
            >
              {product ? "Guardar" : "Crear producto"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
