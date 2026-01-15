import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Box, ChevronDown, ChevronRight, Edit2, Loader2, Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { createInventoryCategory, deleteInventoryCategory } from "@/features/inventory/api";
import { inventoryKeys } from "@/features/inventory/queries";
import type { InventoryItem } from "@/features/inventory/types";

const getStockStatusColor = (stock: number) => {
  if (stock <= 0) return "text-error";
  if (stock < 10) return "text-warning";
  return "text-success";
};

export default function InventorySettingsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Fetch Categories
  const { data: categories } = useSuspenseQuery(inventoryKeys.categories());

  // Fetch Items
  const { data: items } = useSuspenseQuery(inventoryKeys.items());

  const isLoading = false;

  // Group items by category
  const itemsByCategory = items.reduce(
    (acc, item) => {
      const catId = item.category_id ?? 0; // 0 for uncategorized
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(item);
      return acc;
    },
    {} as Record<number, InventoryItem[]>
  );

  // Create Category Mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => createInventoryCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      success("Categoría creada");
      setNewCategoryName("");
      setIsCreating(false);
    },
    onError: () => toastError("Error al crear categoría"),
  });

  // Delete Category Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInventoryCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      success("Categoría eliminada");
    },
    onError: (err) => toastError(err instanceof Error ? err.message : "Error al eliminar categoría"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    createMutation.mutate(newCategoryName);
  };

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const uncategorizedItems = itemsByCategory[0] ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle>Parámetros de inventario</CardTitle>
            <CardDescription>Gestiona las categorías y productos del inventario.</CardDescription>
          </div>
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus size={16} />
            Nueva Categoría
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isCreating && (
            <div className="bg-base-200/30 animate-in fade-in slide-in-from-top-2 border-b p-4">
              <form onSubmit={handleCreate} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="label py-1" htmlFor="category-name">
                    <span className="label-text text-xs">Nombre de la categoría</span>
                  </label>
                  <Input
                    id="category-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ej: Antibióticos"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCreating(false)}
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || !newCategoryName.trim()}>
                    {createMutation.isPending ? <Loader2 className="animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <InventoryList
            isLoading={isLoading}
            categories={categories}
            itemsByCategory={itemsByCategory}
            uncategorizedItems={uncategorizedItems}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            onDeleteCategory={(id) => {
              if (confirm("¿Estás seguro de eliminar esta categoría?")) {
                deleteMutation.mutate(id);
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface InventoryListProps {
  isLoading: boolean;
  categories: { id: number; name: string }[];
  itemsByCategory: Record<number, InventoryItem[]>;
  uncategorizedItems: InventoryItem[];
  expandedCategories: Set<number>;
  toggleCategory: (id: number) => void;
  onDeleteCategory: (id: number) => void;
}

function InventoryList({
  isLoading,
  categories,
  itemsByCategory,
  uncategorizedItems,
  expandedCategories,
  toggleCategory,
  onDeleteCategory,
}: InventoryListProps) {
  if (isLoading) {
    return (
      <div className="text-base-content/50 py-12 text-center">
        <Loader2 className="mx-auto animate-spin" />
      </div>
    );
  }

  if (categories.length === 0 && uncategorizedItems.length === 0) {
    return <div className="text-base-content/50 py-12 text-center">No hay categorías ni items registrados.</div>;
  }

  return (
    <div className="divide-base-200 divide-y border-t">
      {categories.map((category) => {
        const catItems = itemsByCategory[category.id] ?? [];
        const isExpanded = expandedCategories.has(category.id);

        return (
          <div key={category.id}>
            {/* Category Row */}
            <div className="hover:bg-base-200/50 group flex items-center gap-3 p-4 transition-colors">
              <button
                type="button"
                className="flex flex-1 items-center gap-3 text-left focus:outline-none"
                onClick={() => toggleCategory(category.id)}
              >
                <span
                  className="text-base-content/50 flex h-6 w-6 items-center justify-center transition-transform"
                  aria-label={isExpanded ? "Colapsar" : "Expandir"}
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{category.name}</span>
                </div>
                <span className="badge badge-ghost badge-sm">{catItems.length} items</span>
              </button>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="ghost" className="btn-square btn-xs">
                  <Edit2 size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="btn-square btn-xs text-error hover:bg-error/10"
                  onClick={() => onDeleteCategory(category.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            {/* Items List (Expanded) */}
            {isExpanded && catItems.length > 0 && (
              <div className="bg-base-200/30 border-base-200 border-t">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className="hover:bg-base-200/50 border-base-200/50 flex items-center gap-3 border-b py-3 pr-4 pl-14 last:border-b-0"
                  >
                    <div className="bg-base-300/50 text-base-content/40 flex h-6 w-6 items-center justify-center rounded">
                      <Box size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {item.description && <p className="text-base-content/50 truncate text-xs">{item.description}</p>}
                    </div>
                    <span className={`text-xs font-medium ${getStockStatusColor(item.current_stock)}`}>
                      Stock: {item.current_stock}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && catItems.length === 0 && (
              <div className="bg-base-200/30 border-base-200 text-base-content/50 border-t py-4 pl-14 text-sm italic">
                Sin items en esta categoría
              </div>
            )}
          </div>
        );
      })}

      {/* Uncategorized Items */}
      {uncategorizedItems.length > 0 && (
        <div>
          <div className="hover:bg-base-200/50 group flex items-center gap-3 p-4 transition-colors">
            <button
              type="button"
              className="flex flex-1 items-center gap-3 text-left focus:outline-none"
              onClick={() => toggleCategory(0)}
            >
              <span
                className="text-base-content/50 flex h-6 w-6 items-center justify-center"
                aria-label={expandedCategories.has(0) ? "Colapsar" : "Expandir"}
              >
                {expandedCategories.has(0) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <div className="bg-base-300 text-base-content/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <Package size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-base-content/70 font-medium">Sin categoría</span>
              </div>
              <span className="badge badge-ghost badge-sm">{uncategorizedItems.length} items</span>
            </button>
          </div>

          {expandedCategories.has(0) && (
            <div className="bg-base-200/30 border-base-200 border-t">
              {uncategorizedItems.map((item) => (
                <div
                  key={item.id}
                  className="hover:bg-base-200/50 border-base-200/50 flex items-center gap-3 border-b py-3 pr-4 pl-14 last:border-b-0"
                >
                  <div className="bg-base-300/50 text-base-content/40 flex h-6 w-6 items-center justify-center rounded">
                    <Box size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.description && <p className="text-base-content/50 truncate text-xs">{item.description}</p>}
                  </div>
                  <span className={`text-xs font-medium ${getStockStatusColor(item.current_stock)}`}>
                    Stock: {item.current_stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
