import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import { Card, Spinner } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ProductCard } from "@/features/shop/components/ProductCard";
import { shopKeys } from "@/features/shop/queries";

type CatalogProduct = InferContractRouterOutputs<CatalogContract>["list"]["data"][number];

function TiendaPage() {
  const { data, isLoading, error } = useQuery(shopKeys.products());

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <Link className="text-foreground/60 text-sm hover:underline" to="/">
          ← Volver a la página principal
        </Link>
        <h1 className="font-bold text-3xl sm:text-4xl">Tienda Bioalergia</h1>
        <p className="text-foreground/70">
          Productos seleccionados para el cuidado de la piel, hidratación y bienestar.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner /> <span className="ml-3 text-foreground/60">Cargando…</span>
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
          {data.data.map((p: CatalogProduct) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

export const Route = createFileRoute("/tienda/")({
  component: TiendaPage,
});
