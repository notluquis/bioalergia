import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import { Breadcrumbs, Card, Label, ListBox, Select, Skeleton } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { ProductCard } from "@/features/shop/components/ProductCard";
import { SearchBar } from "@/features/shop/components/SearchBar";
import { shopKeys } from "@/features/shop/queries";

type CatalogProduct = InferContractRouterOutputs<CatalogContract>["list"]["data"][number];

const sortSchema = z.object({
  sort: z
    .enum(["relevancia", "precio_asc", "precio_desc"])
    .optional()
    .default("relevancia"),
});

function sortProducts(rows: CatalogProduct[], key: string) {
  if (key === "precio_asc") return [...rows].sort((a, b) => a.price_clp - b.price_clp);
  if (key === "precio_desc") return [...rows].sort((a, b) => b.price_clp - a.price_clp);
  return rows;
}

function TiendaPage() {
  const navigate = Route.useNavigate();
  const { sort } = Route.useSearch();
  const { data, isLoading, error } = useQuery(shopKeys.products());

  const sorted = useMemo(
    () => (data ? sortProducts(data.data, sort) : []),
    [data, sort]
  );

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
          {data ? `${data.data.length} productos` : null}
        </p>
        <Select
          className="w-56"
          onChange={(value) => {
            if (!value) return;
            void navigate({
              search: { sort: value as "relevancia" | "precio_asc" | "precio_desc" },
            });
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
      {error && (
        <Card variant="secondary">
          <Card.Content className="py-8 text-center text-foreground/60">
            No se pudieron cargar los productos.
          </Card.Content>
        </Card>
      )}
      {data && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((p: CatalogProduct) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

export const Route = createFileRoute("/tienda/")({
  component: TiendaPage,
  validateSearch: sortSchema,
  head: () => {
    const origin =
      typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/tienda`;
    return {
      meta: [
        { title: "Tienda · Bioalergia" },
        {
          name: "description",
          content:
            "Productos seleccionados para el cuidado de la piel, hidratación y bienestar. Envío Chilexpress + boleta o factura.",
        },
        { property: "og:title", content: "Tienda · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
