import { useEffect, useState } from "react";
import { getInventoryCategories, createInventoryCategory } from "../api";
import type { InventoryCategory } from "../types";
import { PlusCircle } from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";

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
    <section className="space-y-5 p-6 bg-base-100">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-secondary drop-shadow-sm">Categorías de Inventario</h2>
        <p className="text-sm text-base-content/70">
          Administra las categorías para organizar los items del inventario.
        </p>
      </div>

      <form onSubmit={handleAddCategory} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Nueva Categoría</span>
          <Input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ej: Insumos Médicos"
            className="w-full"
            disabled={saving}
            enterKeyHint="done"
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || !newCategoryName.trim()}
          className="inline-flex items-center gap-2"
        >
          <PlusCircle size={16} />
          {saving ? "Agregando..." : "Agregar"}
        </Button>
      </form>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="max-h-60 overflow-y-auto border border-base-300 bg-base-100 p-3">
        {loading && <p className="text-sm text-base-content">Cargando categorías...</p>}
        {!loading && !categories.length && <p className="text-sm text-base-content">No hay categorías definidas.</p>}
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="rounded-xl border border-base-300 bg-base-200 px-3 py-2 text-sm font-medium text-base-content shadow-sm"
            >
              {cat.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
