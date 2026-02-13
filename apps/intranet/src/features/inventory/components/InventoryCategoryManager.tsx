import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Description } from "@heroui/react";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import type { InventoryCategory } from "../types";
export function InventoryCategoryManager() {
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
    if (queryError instanceof Error) {
      return queryError.message;
    }
    if (createMutation.error instanceof Error) {
      return createMutation.error.message;
    }
    return null;
  })();

  function handleAddCategory(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      return;
    }
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
    <section className="space-y-5 bg-background p-6">
      <div className="space-y-1">
        <span className="block font-semibold text-lg text-secondary drop-shadow-sm">
          Categorías de Inventario
        </span>
        <Description className="text-default-600 text-sm">
          Administra las categorías para organizar los items del inventario.
        </Description>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleAddCategory}>
        <Input
          className="w-full flex-1"
          containerClassName="gap-1"
          disabled={createMutation.isPending}
          enterKeyHint="done"
          id="new-category-name"
          label="Nueva categoría"
          onChange={(e) => {
            setNewCategoryName(e.target.value);
          }}
          placeholder="Ej: Insumos Médicos"
          type="text"
          value={newCategoryName}
        />
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

      {error && <Description className="text-danger text-sm">{error}</Description>}

      <div className="max-h-60 overflow-y-auto border border-default-200 bg-background p-3">
        {loading && (
          <Description className="text-foreground text-sm">Cargando categorías...</Description>
        )}
        {!loading && categories.length === 0 && (
          <Description className="text-foreground text-sm">
            No hay categorías definidas.
          </Description>
        )}
        <ul className="space-y-2">
          {categories.map((cat: InventoryCategory) => (
            <li
              className="rounded-xl border border-default-200 bg-default-50 px-3 py-2 font-medium text-foreground text-sm shadow-sm"
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
