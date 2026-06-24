import { Button, Card, Chip, EmptyState, SearchField } from "@heroui/react";
import type { QuoteProductDto } from "@finanzas/orpc-contracts/quotes";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
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
  beforeLoad: requirePermission("update", "QuoteProduct"),
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

  const columns = useMemo<ColumnDef<QuoteProductDto>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Detalle",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      { accessorKey: "code", header: "Código", cell: ({ row }) => row.original.code ?? "—" },
      { accessorKey: "brand", header: "Marca", cell: ({ row }) => row.original.brand ?? "—" },
      {
        accessorKey: "category",
        header: "Categoría",
        cell: ({ row }) => row.original.category ?? "—",
      },
      { accessorKey: "format", header: "Formato", cell: ({ row }) => row.original.format ?? "—" },
      {
        accessorKey: "unitPrice",
        header: "Precio",
        cell: ({ row }) => formatCurrency(row.original.unitPrice),
      },
      {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Chip variant="primary" size="sm">
              Activo
            </Chip>
          ) : (
            <Chip variant="secondary" size="sm">
              Inactivo
            </Chip>
          ),
      },
    ],
    []
  );

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

        {!productsQuery.isLoading && products.length === 0 ? (
          <EmptyState>
            <div className="space-y-3 text-center">
              <p>Aún no hay productos en el catálogo.</p>
              <Button className="gap-2" onPress={openNew}>
                <Plus size={18} /> Agregar el primero
              </Button>
            </div>
          </EmptyState>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={productsQuery.isLoading}
            enableToolbar={false}
            enableVirtualization={false}
            noDataMessage="Sin resultados para la búsqueda."
            onRowClick={(p) => openEdit(p)}
          />
        )}
      </Card>

      <QuoteProductFormModal isOpen={modalOpen} onOpenChange={setModalOpen} product={editing} />
    </div>
  );
}
