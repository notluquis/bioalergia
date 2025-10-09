import { useEffect, useState } from "react";
import { getInventoryCategories, createInventoryCategory } from "../api";
import type { InventoryCategory } from "../types";
import { PlusCircle } from "lucide-react";

export default function InventoryCategoryManager() {
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    setError(null);
    try {
      const data = await getInventoryCategories();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar las categorías");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await createInventoryCategory(newCategoryName);
      setNewCategoryName("");
      await loadCategories(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la categoría");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-card glass-underlay-gradient space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--brand-secondary)] drop-shadow-sm">Categorías de Inventario</h2>
        <p className="text-sm text-slate-600/90">Administra las categorías para organizar los items del inventario.</p>
      </div>

      <form onSubmit={handleAddCategory} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nueva Categoría</span>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ej: Insumos Médicos"
            className="glass-input w-full"
            disabled={saving}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !newCategoryName.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(14,100,183,0.8)] transition hover:translate-y-[1px] disabled:cursor-not-allowed"
        >
          <PlusCircle size={16} />
          {saving ? "Agregando..." : "Agregar"}
        </button>
      </form>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="glass-card max-h-60 overflow-y-auto border border-white/55 bg-white/60 p-3">
        {loading && <p className="text-sm text-slate-600">Cargando categorías...</p>}
        {!loading && !categories.length && <p className="text-sm text-slate-600">No hay categorías definidas.</p>}
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="rounded-xl border border-white/55 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_24px_-16px_rgba(16,37,66,0.4)]"
            >
              {cat.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
