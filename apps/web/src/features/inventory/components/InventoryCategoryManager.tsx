import { useCreateInventoryCategory, useFindManyInventoryCategory } from "@finanzas/db/hooks";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import type { InventoryCategory } from "../types";

export default function InventoryCategoryManager() {
  const [newCategoryName, setNewCategoryName] = useState("");

  // ZenStack hooks for categories
  const {
    data: categoriesData,
    isLoading: loading,
    error: queryError,
  } = useFindManyInventoryCategory({
    orderBy: { name: "asc" },
  });

  const categories = (categoriesData as any[]) ?? [];

  // ZenStack mutation for creating category
  const createMutation = useCreateInventoryCategory();

  const error = (() => {
    if (queryError instanceof Error) return queryError.message;
    if (createMutation.error instanceof Error) return createMutation.error.message;
    return null;
  })();

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    createMutation.mutate(
      { data: { name: newCategoryName.trim() } },
      {
        onSuccess: () => {
          setNewCategoryName("");
        },
      }
    );
  }

  return (
    <section className="bg-base-100 space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-secondary text-lg font-semibold drop-shadow-sm">Categorías de Inventario</h2>
        <p className="text-base-content/70 text-sm">
          Administra las categorías para organizar los items del inventario.
        </p>
      </div>

      <form onSubmit={handleAddCategory} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1" htmlFor="new-category-name">
          <span className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">Nueva Categoría</span>
          <Input
            id="new-category-name"
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ej: Insumos Médicos"
            className="w-full"
            disabled={createMutation.isPending}
            enterKeyHint="done"
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={createMutation.isPending || !newCategoryName.trim()}
          className="inline-flex items-center gap-2"
        >
          <PlusCircle size={16} />
          {createMutation.isPending ? "Agregando..." : "Agregar"}
        </Button>
      </form>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="border-base-300 bg-base-100 max-h-60 overflow-y-auto border p-3">
        {loading && <p className="text-base-content text-sm">Cargando categorías...</p>}
        {!loading && categories.length === 0 && (
          <p className="text-base-content text-sm">No hay categorías definidas.</p>
        )}
        <ul className="space-y-2">
          {categories.map((cat: InventoryCategory) => (
            <li
              key={cat.id}
              className="border-base-300 bg-base-200 text-base-content rounded-xl border px-3 py-2 text-sm font-medium shadow-sm"
            >
              {cat.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
