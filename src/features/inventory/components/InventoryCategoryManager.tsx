import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { createInventoryCategory, getInventoryCategories } from "../api";
import type { InventoryCategory } from "../types";

export default function InventoryCategoryManager() {
  const [newCategoryName, setNewCategoryName] = useState("");
  const queryClient = useQueryClient();

  // Query for categories
  const {
    data: categories = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: getInventoryCategories,
  });

  // Mutation for creating category
  const createMutation = useMutation({
    mutationFn: createInventoryCategory,
    onSuccess: () => {
      setNewCategoryName("");
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
    },
  });

  const error =
    queryError instanceof Error
      ? queryError.message
      : createMutation.error instanceof Error
        ? createMutation.error.message
        : null;

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    createMutation.mutate(newCategoryName);
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
        {!loading && !categories.length && <p className="text-base-content text-sm">No hay categorías definidas.</p>}
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
