import { Button, Card, Chip, EmptyState, SearchField, Spinner, Table } from "@heroui/react";
import type { QuoteProductDto } from "@finanzas/orpc-contracts/quotes";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { QuoteProductFormModal } from "@/features/quotes/components/QuoteProductFormModal";
import { listQuoteProducts, quotesKeys } from "@/features/quotes/api";
import { formatCurrency } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/styles";

const EMPTY: never[] = [];

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

function QuotesCatalogSettingsPage() {
  const productsQuery = useQuery({ queryKey: quotesKeys.products(), queryFn: listQuoteProducts });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteProductDto | undefined>(undefined);

  const products = productsQuery.data ?? EMPTY;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.code, p.brand, p.category, p.name, p.format].some(
        (v) => v != null && v.toLowerCase().includes(q)
      )
    );
  }, [products, search]);

  const openNew = () => {
    setEditing(undefined);
    setModalOpen(true);
  };
  const openEdit = (p: QuoteProductDto) => {
    setEditing(p);
    setModalOpen(true);
  };

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <FileSpreadsheet size={22} /> Catálogo de cotizaciones
          </h1>
          <p className="text-default-500 text-sm">
            Productos que aparecen en el buscador al armar una cotización.
          </p>
        </div>
        <Button className="gap-2" onPress={openNew}>
          <Plus size={18} /> Agregar producto
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <SearchField
          value={search}
          onChange={setSearch}
          aria-label="Buscar producto"
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar por código, marca, categoría o detalle…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {productsQuery.isLoading ? (
          <Spinner aria-label="Cargando productos" />
        ) : filtered.length === 0 ? (
          <EmptyState>
            {products.length === 0 ? (
              <div className="space-y-3 text-center">
                <p>Aún no hay productos en el catálogo.</p>
                <Button className="gap-2" onPress={openNew}>
                  <Plus size={18} /> Agregar el primero
                </Button>
              </div>
            ) : (
              "Sin resultados para la búsqueda."
            )}
          </EmptyState>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Catálogo de productos" className="min-w-[720px]">
                <Table.Header>
                  <Table.Column isRowHeader>Detalle</Table.Column>
                  <Table.Column>Código</Table.Column>
                  <Table.Column>Marca</Table.Column>
                  <Table.Column>Categoría</Table.Column>
                  <Table.Column>Formato</Table.Column>
                  <Table.Column>Precio</Table.Column>
                  <Table.Column>Estado</Table.Column>
                </Table.Header>
                <Table.Body>
                  {filtered.map((p) => (
                    <Table.Row
                      key={p.id}
                      id={p.id}
                      className="cursor-pointer"
                      onAction={() => openEdit(p)}
                    >
                      <Table.Cell className="font-medium">{p.name}</Table.Cell>
                      <Table.Cell>{p.code ?? "—"}</Table.Cell>
                      <Table.Cell>{p.brand ?? "—"}</Table.Cell>
                      <Table.Cell>{p.category ?? "—"}</Table.Cell>
                      <Table.Cell>{p.format ?? "—"}</Table.Cell>
                      <Table.Cell>{formatCurrency(p.unitPrice)}</Table.Cell>
                      <Table.Cell>
                        {p.isActive ? (
                          <Chip variant="primary" size="sm">
                            Activo
                          </Chip>
                        ) : (
                          <Chip variant="secondary" size="sm">
                            Inactivo
                          </Chip>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card>

      <QuoteProductFormModal isOpen={modalOpen} onOpenChange={setModalOpen} product={editing} />
    </div>
  );
}
