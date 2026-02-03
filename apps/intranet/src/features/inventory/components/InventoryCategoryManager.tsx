import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import type { InventoryCategory } from "../types";

export default function InventoryCategoryManager() {
  const client = useClientQueries(schemaLite);

  const [newCategoryName, setNewCategoryName] = useState("");

  // ZenStack hooks for categories
  const {
    data: categoriesData,
    error: queryError,
    isLoading: loading,
  } = client.inventoryCategory.useFindMany({
    orderBy: { name: "asc" },
  });

  const categories: InventoryCategory[] = categoriesData ?? [];

  // ZenStack mutation for creating category
  const createMutation = client.inventoryCategory.useCreate();

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
      },
    );
  }

  return (
    <section className="bg-background space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-secondary text-lg font-semibold drop-shadow-sm">
          Categorías de Inventario
        </h2>
        <p className="text-default-600 text-sm">
          Administra las categorías para organizar los items del inventario.
        </p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleAddCategory}>
        <label className="flex-1" htmlFor="new-category-name">
          <span className="text-default-500 text-xs font-semibold tracking-wide uppercase">
            Nueva Categoría
          </span>
          <Input
            className="w-full"
            disabled={createMutation.isPending}
            enterKeyHint="done"
            id="new-category-name"
            onChange={(e) => {
              setNewCategoryName(e.target.value);
            }}
            placeholder="Ej: Insumos Médicos"
            type="text"
            value={newCategoryName}
          />
        </label>
        <Button
          className="inline-flex items-center gap-2"
          disabled={createMutation.isPending || !newCategoryName.trim()}
          size="sm"
          type="submit"
          variant="primary"
        >
          <PlusCircle size={16} />
          {createMutation.isPending ? "Agregando..." : "Agregar"}
        </Button>
      </form>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="border-default-200 bg-background max-h-60 overflow-y-auto border p-3">
        {loading && <p className="text-foreground text-sm">Cargando categorías...</p>}
        {!loading && categories.length === 0 && (
          <p className="text-foreground text-sm">No hay categorías definidas.</p>
        )}
        <ul className="space-y-2">
          {categories.map((cat: InventoryCategory) => (
            <li
              className="border-default-200 bg-default-50 text-foreground rounded-xl border px-3 py-2 text-sm font-medium shadow-sm"
              key={cat.id}
            >
              {cat.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
