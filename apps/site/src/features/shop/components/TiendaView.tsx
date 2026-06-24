import { Breadcrumbs, Card, Label, ListBox, Select, Skeleton } from "@heroui/react";

import { ProductCard } from "@/features/shop/components/ProductCard";
import { SearchBar } from "@/features/shop/components/SearchBar";
import type { SortKey } from "@/features/shop/lib/catalog";

// Presentational view for /tienda. NO data fetching, NO Route.* hooks: it takes
// already-sorted products + UI state + a sort callback as plain props so it can
// be mounted in Storybook (Chromatic) and reasoned about in isolation. The route
// wrapper (routes/tienda/index.tsx) wires the query + navigation to these props.

export type TiendaViewProduct = React.ComponentProps<typeof ProductCard>["product"];

export type TiendaViewProps = {
  /** Products already sorted by the active `sort` (empty while loading/error). */
  products: TiendaViewProduct[];
  /** Total product count to show in the counter, or null to hide it. */
  productCount: number | null;
  /** The active sort key (controls the Select value). */
  sort: SortKey;
  isLoading: boolean;
  /** Truthy when the products query failed. */
  error: unknown;
  /** Called with the new sort key when the user changes the Select. */
  onSortChange: (sort: SortKey) => void;
};

export function TiendaView({
  products,
  productCount,
  sort,
  isLoading,
  error,
  onSortChange,
}: TiendaViewProps) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item>Tienda</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="space-y-2">
        <h1 className="font-bold text-3xl sm:text-4xl">Tienda Bioalergia</h1>
        <p className="text-foreground/70">
          Productos seleccionados para el cuidado de la piel, hidratación y bienestar.
        </p>
      </header>

      <SearchBar />

      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground/60 text-sm">
          {productCount !== null ? `${productCount} productos` : null}
        </p>
        <Select
          className="w-56"
          onChange={(value) => {
            if (!value) return;
            onSortChange(value as SortKey);
          }}
          value={sort}
        >
          <Label className="sr-only">Ordenar</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="relevancia" textValue="Más relevantes">
                Más relevantes
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="precio_asc" textValue="Precio: menor a mayor">
                Precio: menor a mayor
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="precio_desc" textValue="Precio: mayor a menor">
                Precio: mayor a menor
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton className="h-96 w-full rounded-2xl" key={i} />
          ))}
        </div>
      )}
      {Boolean(error) && (
        <Card variant="secondary">
          <Card.Content className="py-8 text-center text-foreground/60">
            No se pudieron cargar los productos.
          </Card.Content>
        </Card>
      )}
      {productCount !== null && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
