import { Description } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fmtCLP, formatDate } from "@/lib/format";
import { inventoryKeys } from "../queries";
import type { AllergyInventoryOverview } from "../types";

function AllergyInventoryView() {
  const {
    data,
    isFetching,
    isLoading: loading,
    error,
    refetch,
  } = useSuspenseQuery(inventoryKeys.allergyOverview());

  const grouped = (() => {
    const map = new Map<
      string,
      {
        categories: Map<string, AllergyInventoryOverview[]>;
        typeName: string;
      }
    >();

    for (const item of data) {
      const typeName = item.allergy_type.type?.name ?? "Otros";
      const categoryName = item.allergy_type.category?.name ?? "Sin categoría";
      const entry = map.get(typeName) ?? { categories: new Map(), typeName };
      const categoryItems = entry.categories.get(categoryName) ?? [];
      categoryItems.push(item);
      entry.categories.set(categoryName, categoryItems);
      map.set(typeName, entry);
    }

    return map;
  })();

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

  return (
    <section className="surface-recessed space-y-4 rounded-3xl p-6 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Description className="text-default-500 text-xs uppercase tracking-[0.3em]">
            Insumos de alergia
          </Description>
          <span className="block font-semibold text-foreground text-xl">
            Reactivos y haptenos con proveedores
          </span>
          <Description className="text-default-600 text-xs">
            Agrupados por tipo/categoría. Revisa stock, precio y cuentas disponibles.
          </Description>
        </div>
        <Button disabled={isFetching} onClick={() => void refetch()} size="sm" variant="ghost">
          {/* biome-ignore lint/security/noSecrets: UI label, not a secret */}{" "}
          {isFetching ? "Actualizando…" : "Refrescar"}
        </Button>
      </div>
      {errorMessage && <Alert status="danger">{errorMessage}</Alert>}
      {loading && data.length === 0 && (
        <Description className="text-default-500 text-xs">Cargando datos…</Description>
      )}
      {!loading && data.length === 0 && (
        <Description className="text-default-500 text-xs">
          No hay insumos registrados aún.
        </Description>
      )}
      <div className="space-y-6">
        {[...grouped.values()].map((group) => (
          <div className="space-y-4" key={group.typeName}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-lg">{group.typeName}</span>
              <span className="text-default-600 text-xs">{group.categories.size} categorías</span>
            </div>
            <div className="space-y-4">
              {[...group.categories.entries()].map(([categoryName, items]) => (
                <div
                  className="rounded-2xl border border-default-200/60 bg-background/80 p-4 shadow-sm"
                  key={categoryName}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">{categoryName}</span>
                    <span className="text-default-500 text-xs">{items.length} insumos</span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {items.map((item) => (
                      <ItemCard item={item} key={item.item_id} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ItemCard({ item }: { item: AllergyInventoryOverview }) {
  return (
    <div className="rounded-2xl border border-default-200 bg-background p-3 text-foreground text-sm shadow-inner">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{item.name}</span>
        <span className="text-default-500 text-xs">Stock {item.current_stock}</span>
      </div>
      {item.description && (
        <Description className="mt-1 text-default-600 text-xs">{item.description}</Description>
      )}
      <div className="mt-3 space-y-2 text-xs">
        {item.providers.length > 0 ? (
          item.providers.map((p) => <ProviderCard key={p.provider_id} provider={p} />)
        ) : (
          <Description className="text-default-400 text-xs italic">
            Sin proveedores asignados
          </Description>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: AllergyInventoryOverview["providers"][number] }) {
  return (
    <div className="space-y-1 rounded-xl border border-default-100 bg-default-50/80 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{provider.provider_name}</span>
        <span className="text-default-400 text-xs uppercase tracking-wide">
          {provider.provider_rut}
        </span>
      </div>
      <Description className="text-default-600 text-xs">
        Precio: {provider.current_price == null ? "Sin precio" : fmtCLP(provider.current_price)}
      </Description>
      <Description className="text-[11px] text-default-500">
        Último stock: {provider.last_stock_check ? formatDate(provider.last_stock_check) : "Nunca"}
      </Description>
      <Description className="text-[11px] text-default-500">
        Último precio: {provider.last_price_check ? formatDate(provider.last_price_check) : "Nunca"}
      </Description>
      <Description className="text-[11px] text-default-500">
        Cuentas: {provider.accounts.join(", ") || "Sin cuentas"}
      </Description>
    </div>
  );
}
export { AllergyInventoryView };
