import { Button, Description, Input, Label, Skeleton, TextField } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { createInventoryCategory } from "../api";
import { inventoryKeys } from "../queries";

import type { InventoryCategory } from "../types";
export function InventoryCategoryManager() {
  const [newCategoryName, setNewCategoryName] = useState("");

  const {
    data: categories = [],
    error: queryError,
    isLoading: loading,
  } = useQuery(inventoryKeys.categories());

  const createMutation = useMutation({
    mutationFn: (name: string) => createInventoryCategory(name),
    onSuccess: () => {
      setNewCategoryName("");
    },
  });

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
    createMutation.mutate(newCategoryName.trim());
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
        <TextField
          className="w-full flex-1"
          isDisabled={createMutation.isPending}
          onChange={setNewCategoryName}
          type="text"
          value={newCategoryName}
        >
          <Label htmlFor="new-category-name">Nueva categoría</Label>
          <Input enterKeyHint="done" id="new-category-name" placeholder="Ej: Insumos Médicos" />
        </TextField>
        <Button
          className="inline-flex items-center gap-2"
          isDisabled={createMutation.isPending || !newCategoryName.trim()}
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
          <div className="space-y-2">
            {["1", "2", "3", "4"].map((skeletonKey) => (
              <Skeleton
                className="h-10 w-full rounded-xl"
                key={`inventory-category-skeleton-${skeletonKey}`}
              />
            ))}
          </div>
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
