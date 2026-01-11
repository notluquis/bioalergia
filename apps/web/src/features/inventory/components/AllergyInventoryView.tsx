import { useQuery } from "@tanstack/react-query";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { fmtCLP, formatDate } from "@/lib/format";

import { fetchAllergyOverview } from "../api";
import type { AllergyInventoryOverview } from "../types";

function ProviderCard({ provider }: { provider: AllergyInventoryOverview["providers"][number] }) {
  return (
    <div className="border-base-200 bg-base-200/80 space-y-1 rounded-xl border px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{provider.provider_name}</span>
        <span className="text-base-content/50 text-xs tracking-wide uppercase">{provider.provider_rut}</span>
      </div>
      <p className="text-base-content/70 text-xs">
        Precio: {provider.current_price == null ? "Sin precio" : fmtCLP(provider.current_price)}
      </p>
      <p className="text-base-content/60 text-[11px]">
        Último stock: {provider.last_stock_check ? formatDate(provider.last_stock_check) : "Nunca"}
      </p>
      <p className="text-base-content/60 text-[11px]">
        Último precio: {provider.last_price_check ? formatDate(provider.last_price_check) : "Nunca"}
      </p>
      <p className="text-base-content/60 text-[11px]">Cuentas: {provider.accounts.join(", ") || "Sin cuentas"}</p>
    </div>
  );
}

function ItemCard({ item }: { item: AllergyInventoryOverview }) {
  return (
    <div className="border-base-300 bg-base-100 text-base-content rounded-2xl border p-3 text-sm shadow-inner">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{item.name}</p>
        <span className="text-base-content/60 text-xs">Stock {item.current_stock}</span>
      </div>
      {item.description && <p className="text-base-content/70 mt-1 text-xs">{item.description}</p>}
      <div className="mt-3 space-y-2 text-xs">
        {item.providers.length > 0 ? (
          item.providers.map((p) => <ProviderCard key={p.provider_id} provider={p} />)
        ) : (
          <p className="text-base-content/50 text-xs italic">Sin proveedores asignados</p>
        )}
      </div>
    </div>
  );
}

function AllergyInventoryView() {
  const {
    data = [],
    isLoading: loading,
    error: queryError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["allergy-inventory-overview"],
    queryFn: fetchAllergyOverview,
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const grouped = (() => {
    const map = new Map<
      string,
      {
        typeName: string;
        categories: Map<string, AllergyInventoryOverview[]>;
      }
    >();

    data.forEach((item) => {
      const typeName = item.allergy_type.type?.name ?? "Otros";
      const categoryName = item.allergy_type.category?.name ?? "Sin categoría";
      const entry = map.get(typeName) ?? { typeName, categories: new Map() };
      const categoryItems = entry.categories.get(categoryName) ?? [];
      categoryItems.push(item);
      entry.categories.set(categoryName, categoryItems);
      map.set(typeName, entry);
    });

    return map;
  })();

  return (
    <section className="surface-recessed space-y-4 rounded-3xl p-6 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base-content/60 text-xs tracking-[0.3em] uppercase">Insumos de alergia</p>
          <h3 className="text-base-content text-xl font-semibold">Reactivos y haptenos con proveedores</h3>
          <p className="text-base-content/70 text-xs">
            Agrupados por tipo/categoría. Revisa stock, precio y cuentas disponibles.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Actualizando…" : "Refrescar"}
        </Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {loading && data.length === 0 && <p className="text-base-content/60 text-xs">Cargando datos…</p>}
      {!loading && data.length === 0 && <p className="text-base-content/60 text-xs">No hay insumos registrados aún.</p>}
      <div className="space-y-6">
        {[...grouped.values()].map((group) => (
          <div key={group.typeName} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base-content text-lg font-semibold">{group.typeName}</h4>
              <span className="text-base-content/70 text-xs">{group.categories.size} categorías</span>
            </div>
            <div className="space-y-4">
              {[...group.categories.entries()].map(([categoryName, items]) => (
                <div key={categoryName} className="border-base-300/60 bg-base-100/80 rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-base-content text-sm font-semibold">{categoryName}</p>
                    <span className="text-base-content/60 text-xs">{items.length} insumos</span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {items.map((item) => (
                      <ItemCard key={item.item_id} item={item} />
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

export default AllergyInventoryView;
