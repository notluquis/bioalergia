import { useEffect, useMemo, useState, useCallback } from "react";
import Alert from "../../../components/Alert";
import Button from "../../../components/Button";
import { fmtCLP } from "../../../lib/format";
import type { AllergyInventoryOverview } from "../types";

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  try {
    return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return value;
  }
}

function AllergyInventoryView() {
  const [data, setData] = useState<AllergyInventoryOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/allergy-overview");
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message ?? "No se pudo cargar el catálogo");
      }
      setData(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const grouped = useMemo(() => {
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
  }, [data]);

  return (
    <section className="surface-recessed space-y-4 rounded-[28px] p-6 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">Insumos de alergia</p>
          <h3 className="text-xl font-semibold text-base-content">Reactivos y haptenos con proveedores</h3>
          <p className="text-xs text-base-content/70">
            Agrupados por tipo/categoría. Revisa stock, precio y cuentas disponibles.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void fetchData()} disabled={loading}>
          {loading ? "Actualizando…" : "Refrescar"}
        </Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {loading && !data.length && <p className="text-xs text-base-content/60">Cargando datos…</p>}
      {!loading && !data.length && <p className="text-xs text-base-content/60">No hay insumos registrados aún.</p>}
      <div className="space-y-6">
        {Array.from(grouped.values()).map((group) => (
          <div key={group.typeName} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-base-content">{group.typeName}</h4>
              <span className="text-xs text-base-content/70">{group.categories.size} categorías</span>
            </div>
            <div className="space-y-4">
              {Array.from(group.categories.entries()).map(([categoryName, items]) => (
                <div key={categoryName} className="rounded-2xl border border-base-300/60 bg-base-100/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-base-content">{categoryName}</p>
                    <span className="text-xs text-base-content/60">{items.length} insumos</span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {items.map((item) => (
                      <div
                        key={item.item_id}
                        className="rounded-2xl border border-base-300 bg-base-100 p-3 text-sm text-base-content shadow-inner"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{item.name}</p>
                          <span className="text-xs text-base-content/60">Stock {item.current_stock}</span>
                        </div>
                        {item.description && <p className="mt-1 text-xs text-base-content/70">{item.description}</p>}
                        <div className="mt-3 space-y-2 text-xs">
                          {item.providers.length ? (
                            item.providers.map((provider) => (
                              <div
                                key={provider.provider_id}
                                className="space-y-1 rounded-xl border border-base-200 bg-base-200/80 px-3 py-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{provider.provider_name}</span>
                                  <span className="text-[11px] uppercase tracking-wide text-base-content/50">
                                    {provider.provider_rut}
                                  </span>
                                </div>
                                <p className="text-xs text-base-content/70">
                                  Precio:{" "}
                                  {provider.current_price != null ? fmtCLP(provider.current_price) : "Sin precio"}
                                </p>
                                <p className="text-[11px] text-base-content/60">
                                  Último stock: {formatDate(provider.last_stock_check)}
                                </p>
                                <p className="text-[11px] text-base-content/60">
                                  Último precio: {formatDate(provider.last_price_check)}
                                </p>
                                <p className="text-[11px] text-base-content/60">
                                  Cuentas: {provider.accounts.join(", ") || "Sin cuentas"}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs italic text-base-content/50">Sin proveedores asignados</p>
                          )}
                        </div>
                      </div>
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
