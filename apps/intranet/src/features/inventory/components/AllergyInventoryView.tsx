import { useSuspenseQuery } from "@tanstack/react-query";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
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
          <p className="text-default-500 text-xs tracking-[0.3em] uppercase">Insumos de alergia</p>
          <h3 className="text-foreground text-xl font-semibold">
            Reactivos y haptenos con proveedores
          </h3>
          <p className="text-default-600 text-xs">
            Agrupados por tipo/categoría. Revisa stock, precio y cuentas disponibles.
          </p>
        </div>
        <Button disabled={isFetching} onClick={() => void refetch()} size="sm" variant="ghost">
          {isFetching ? "Actualizando…" : "Refrescar"}
        </Button>
      </div>
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {loading && data.length === 0 && <p className="text-default-500 text-xs">Cargando datos…</p>}
      {!loading && data.length === 0 && (
        <p className="text-default-500 text-xs">No hay insumos registrados aún.</p>
      )}
      <div className="space-y-6">
        {[...grouped.values()].map((group) => (
          <div className="space-y-4" key={group.typeName}>
            <div className="flex items-center justify-between">
              <h4 className="text-foreground text-lg font-semibold">{group.typeName}</h4>
              <span className="text-default-600 text-xs">{group.categories.size} categorías</span>
            </div>
            <div className="space-y-4">
              {[...group.categories.entries()].map(([categoryName, items]) => (
                <div
                  className="border-default-200/60 bg-background/80 rounded-2xl border p-4 shadow-sm"
                  key={categoryName}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-foreground text-sm font-semibold">{categoryName}</p>
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
    <div className="border-default-200 bg-background text-foreground rounded-2xl border p-3 text-sm shadow-inner">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{item.name}</p>
        <span className="text-default-500 text-xs">Stock {item.current_stock}</span>
      </div>
      {item.description && <p className="text-default-600 mt-1 text-xs">{item.description}</p>}
      <div className="mt-3 space-y-2 text-xs">
        {item.providers.length > 0 ? (
          item.providers.map((p) => <ProviderCard key={p.provider_id} provider={p} />)
        ) : (
          <p className="text-default-400 text-xs italic">Sin proveedores asignados</p>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: AllergyInventoryOverview["providers"][number] }) {
  return (
    <div className="border-default-100 bg-default-50/80 space-y-1 rounded-xl border px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{provider.provider_name}</span>
        <span className="text-default-400 text-xs tracking-wide uppercase">
          {provider.provider_rut}
        </span>
      </div>
      <p className="text-default-600 text-xs">
        Precio: {provider.current_price == null ? "Sin precio" : fmtCLP(provider.current_price)}
      </p>
      <p className="text-default-500 text-[11px]">
        Último stock: {provider.last_stock_check ? formatDate(provider.last_stock_check) : "Nunca"}
      </p>
      <p className="text-default-500 text-[11px]">
        Último precio: {provider.last_price_check ? formatDate(provider.last_price_check) : "Nunca"}
      </p>
      <p className="text-default-500 text-[11px]">
        Cuentas: {provider.accounts.join(", ") || "Sin cuentas"}
      </p>
    </div>
  );
}

export default AllergyInventoryView;
