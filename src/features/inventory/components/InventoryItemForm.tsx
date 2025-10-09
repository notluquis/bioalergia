import { useEffect, useState } from "react";
import { InventoryCategory, InventoryItem } from "../types";
import { getInventoryCategories } from "../api";

interface InventoryItemFormProps {
  item?: InventoryItem | null;
  onSave: (item: Omit<InventoryItem, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function InventoryItemForm({ item, onSave, onCancel, saving }: InventoryItemFormProps) {
  const [form, setForm] = useState({
    ...item,
    category_id: item?.category_id ?? null,
    description: item?.description ?? "",
  });
  const [categories, setCategories] = useState<InventoryCategory[]>([]);

  useEffect(() => {
    getInventoryCategories().then(setCategories);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form as Omit<InventoryItem, "id">);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nombre del Item
          <input
            type="text"
            value={form.name ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Categoría
          <select
            value={form.category_id ?? ""}
            onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}
            className="rounded border px-3 py-2"
          >
            <option value="">Sin categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Descripción
        <textarea
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="rounded border px-3 py-2"
          rows={3}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Stock Inicial
        <input
          type="number"
          value={form.current_stock ?? 0}
          onChange={(e) => setForm({ ...form, current_stock: Number(e.target.value) })}
          required
          className="rounded border px-3 py-2"
          disabled={!!item} // Disable if editing
        />
      </label>
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : "Guardar Item"}
        </button>
      </div>
    </form>
  );
}
