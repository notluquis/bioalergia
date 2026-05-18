import { Alert, Button, Card, Chip, Modal, Table } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Archive, Edit3, Lock, PlusCircle } from "lucide-react";
import { useState } from "react";

import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { archiveProduct, createProduct, updateProduct } from "../api";
import { ImageUploader } from "../components/ImageUploader";
import { ProductForm, type ProductFormValues } from "../components/ProductForm";
import { catalogKeys } from "../queries";

type QueryFn = NonNullable<ReturnType<typeof catalogKeys.products>["queryFn"]>;
type ProductsList = Awaited<ReturnType<QueryFn>>;
type ProductRow = ProductsList["data"][number];

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "primary" | "secondary" | "soft" } | undefined
> = {
  ACTIVE: { label: "Activo", variant: "primary" },
  DRAFT: { label: "Borrador", variant: "secondary" },
  ARCHIVED: { label: "Archivado", variant: "soft" },
};
const STATUS_FALLBACK = {
  label: "Borrador",
  variant: "secondary" as const,
};

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function CatalogPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const canCreate = can("create", "InventoryItem");
  const canUpdate = can("update", "InventoryItem");

  const { data: list } = useSuspenseQuery(catalogKeys.products({ includeInactive: true }));
  const products = list.data;

  const [error, setError] = useState<null | string>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const createMutation = useMutation({ mutationFn: createProduct });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProductFormValues }) =>
      updateProduct(id, values),
  });
  const archiveMutation = useMutation({ mutationFn: (id: number) => archiveProduct(id) });

  const saving = createMutation.isPending || updateMutation.isPending;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  }

  function openCreate() {
    setEditing(null);
    setIsFormOpen(true);
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditing(null);
  }

  function rowToFormValues(row: ProductRow): Partial<ProductFormValues> {
    return {
      slug: row.slug,
      sku: row.sku,
      name: row.name,
      short_description: row.short_description ?? "",
      description: row.description ?? "",
      category_id: row.category_id,
      brand: row.brand ?? "",
      price_clp: row.price_clp,
      compare_at_price_clp: row.compare_at_price_clp,
      cost_clp: row.cost_clp,
      weight_grams: row.weight_grams,
      barcode: row.barcode ?? "",
      requires_prescription: row.requires_prescription,
      status: row.status,
      seo_title: row.seo_title ?? "",
      seo_description: row.seo_description ?? "",
      available_qty: row.available_qty,
      safety_stock: row.safety_stock,
    };
  }

  async function handleSave(values: ProductFormValues) {
    setError(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, values });
        toastSuccess("Producto actualizado");
      } else {
        await createMutation.mutateAsync(values);
        toastSuccess("Producto creado");
      }
      invalidate();
      closeForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el producto";
      setError(message);
      toastError(message);
    }
  }

  async function handleArchive(id: number) {
    const ok = await confirmAction({
      title: "¿Archivar este producto?",
      description: "Dejará de mostrarse en la tienda.",
      variant: "danger",
      confirmLabel: "Archivar",
    });
    if (!ok) return;
    try {
      await archiveMutation.mutateAsync(id);
      toastSuccess("Producto archivado");
      invalidate();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "No se pudo archivar");
    }
  }

  return (
    <section className="space-y-6">
      {error && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Card.Title>Catálogo de productos</Card.Title>
            <Card.Description>
              {products.length} producto{products.length === 1 ? "" : "s"} cargado
              {products.length === 1 ? "" : "s"}
            </Card.Description>
          </div>
          <Button className="w-full sm:w-auto" isDisabled={!canCreate} onPress={openCreate}>
            {canCreate ? <PlusCircle size={16} /> : <Lock size={16} />}
            Agregar producto
          </Button>
        </Card.Header>

        {/* Desktop / tablet: tabla HeroUI compound (scroll horizontal en pantallas chicas) */}
        <Card.Content className="hidden md:block">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Productos del catálogo" className="min-w-[760px]">
                <Table.Header>
                  <Table.Column isRowHeader>SKU</Table.Column>
                  <Table.Column>Nombre</Table.Column>
                  <Table.Column>Marca</Table.Column>
                  <Table.Column>Precio</Table.Column>
                  <Table.Column>Stock</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column>Acciones</Table.Column>
                </Table.Header>
                <Table.Body>
                  {products.map((p) => {
                    const badge = STATUS_LABEL[p.status] ?? STATUS_FALLBACK;
                    return (
                      <Table.Row id={String(p.id)} key={p.id}>
                        <Table.Cell>
                          <span className="font-mono text-xs">{p.sku}</span>
                        </Table.Cell>
                        <Table.Cell>{p.name}</Table.Cell>
                        <Table.Cell>{p.brand ?? "—"}</Table.Cell>
                        <Table.Cell>{CLP.format(p.price_clp)}</Table.Cell>
                        <Table.Cell>{p.available_qty}</Table.Cell>
                        <Table.Cell>
                          <Chip variant={badge.variant}>{badge.label}</Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-2">
                            <Button
                              isDisabled={!canUpdate}
                              onPress={() => openEdit(p)}
                              size="sm"
                              variant="outline"
                            >
                              <Edit3 size={14} />
                            </Button>
                            <Button
                              isDisabled={!canUpdate || p.status === "ARCHIVED"}
                              onPress={() => {
                                void handleArchive(p.id);
                              }}
                              size="sm"
                              variant="danger-soft"
                            >
                              <Archive size={14} />
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          {products.length === 0 && (
            <p className="py-8 text-center text-foreground/60 text-sm">
              Sin productos. Crea el primero con el botón de arriba.
            </p>
          )}
        </Card.Content>

        {/* Mobile: lista de cards (estilo stack) */}
        <Card.Content className="space-y-3 md:hidden">
          {products.map((p) => {
            const badge = STATUS_LABEL[p.status] ?? STATUS_FALLBACK;
            return (
              <Card key={p.id} variant="secondary">
                <Card.Header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Card.Title className="truncate text-sm">{p.name}</Card.Title>
                    <Card.Description className="font-mono text-xs">
                      SKU {p.sku}
                      {p.brand ? ` · ${p.brand}` : ""}
                    </Card.Description>
                  </div>
                  <Chip variant={badge.variant}>{badge.label}</Chip>
                </Card.Header>
                <Card.Content className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{CLP.format(p.price_clp)}</span>
                  <span className="text-foreground/60">Stock: {p.available_qty}</span>
                </Card.Content>
                <Card.Footer className="flex gap-2">
                  <Button
                    className="flex-1"
                    isDisabled={!canUpdate}
                    onPress={() => openEdit(p)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit3 size={14} /> Editar
                  </Button>
                  <Button
                    isDisabled={!canUpdate || p.status === "ARCHIVED"}
                    onPress={() => {
                      void handleArchive(p.id);
                    }}
                    size="sm"
                    variant="danger-soft"
                  >
                    <Archive size={14} />
                  </Button>
                </Card.Footer>
              </Card>
            );
          })}
          {products.length === 0 && (
            <p className="py-8 text-center text-foreground/60 text-sm">
              Sin productos. Agrega el primero.
            </p>
          )}
        </Card.Content>
      </Card>

      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen={isFormOpen}
          onOpenChange={(open) => {
            if (!open) closeForm();
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative mx-4 w-full max-w-3xl rounded-[28px] bg-background p-4 shadow-2xl sm:p-6">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>
                  {editing ? `Editar: ${editing.name}` : "Agregar producto"}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] space-y-6 overflow-y-auto overscroll-contain text-foreground">
                <ProductForm
                  initial={editing ? rowToFormValues(editing) : null}
                  onCancel={closeForm}
                  onSave={(...args) => {
                    void handleSave(...args);
                  }}
                  saving={saving}
                />
                {editing && (
                  <div className="border-foreground/10 border-t pt-6">
                    <h3 className="mb-3 font-semibold text-primary text-sm">Imágenes</h3>
                    <ImageUploader images={editing.images ?? []} productId={editing.id} />
                  </div>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
