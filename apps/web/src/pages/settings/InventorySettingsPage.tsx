import { Chip } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Edit2,
  Loader2,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
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

interface InventoryListProps {
  categories: { id: number; name: string }[];
  expandedCategories: Set<number>;
  isLoading: boolean;
  itemsByCategory: Record<number, InventoryItem[]>;
  onDeleteCategory: (id: number) => void;
  toggleCategory: (id: number) => void;
  uncategorizedItems: InventoryItem[];
}

export default function InventorySettingsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const { error: toastError, success } = useToast();
  const queryClient = useQueryClient();

  // Fetch Categories
  const { data: categories } = useSuspenseQuery(inventoryKeys.categories());

  // Fetch Items
  const { data: items } = useSuspenseQuery(inventoryKeys.items());

  const isLoading = false;

  // Group items by category
  const itemsByCategory = items.reduce<Record<number, InventoryItem[]>>((acc, item) => {
    const catId = item.category_id ?? 0; // 0 for uncategorized
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(item);
    return acc;
  }, {});

  // Create Category Mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => createInventoryCategory(name),
    onError: () => {
      toastError("Error al crear categoría");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      success("Categoría creada");
      setNewCategoryName("");
      setIsCreating(false);
    },
  });

  // Delete Category Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInventoryCategory(id),
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error al eliminar categoría");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      success("Categoría eliminada");
    },
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
          <Button
            className="gap-2"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Plus size={16} />
            Nueva Categoría
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isCreating && (
            <div className="bg-base-200/30 animate-in fade-in slide-in-from-top-2 border-b p-4">
              <form className="flex items-end gap-3" onSubmit={handleCreate}>
                <div className="flex-1">
                  <label className="label py-1" htmlFor="category-name">
                    <span className="label-text text-xs">Nombre de la categoría</span>
                  </label>
                  <Input
                    id="category-name"
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                    }}
                    placeholder="Ej: Antibióticos"
                    value={newCategoryName}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={createMutation.isPending}
                    onClick={() => {
                      setIsCreating(false);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={createMutation.isPending || !newCategoryName.trim()}
                    type="submit"
                  >
                    {createMutation.isPending ? <Loader2 className="animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <InventoryList
            categories={categories}
            expandedCategories={expandedCategories}
            isLoading={isLoading}
            itemsByCategory={itemsByCategory}
            onDeleteCategory={(id) => {
              if (confirm("¿Estás seguro de eliminar esta categoría?")) {
                deleteMutation.mutate(id);
              }
            }}
            toggleCategory={toggleCategory}
            uncategorizedItems={uncategorizedItems}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryList({
  categories,
  expandedCategories,
  isLoading,
  itemsByCategory,
  onDeleteCategory,
  toggleCategory,
  uncategorizedItems,
}: InventoryListProps) {
  if (isLoading) {
    return (
      <div className="text-base-content/50 py-12 text-center">
        <Loader2 className="mx-auto animate-spin" />
      </div>
    );
  }

  if (categories.length === 0 && uncategorizedItems.length === 0) {
    return (
      <div className="text-base-content/50 py-12 text-center">
        No hay categorías ni items registrados.
      </div>
    );
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
                className="flex flex-1 items-center gap-3 text-left focus:outline-none"
                onClick={() => {
                  toggleCategory(category.id);
                }}
                type="button"
              >
                <span
                  aria-label={isExpanded ? "Colapsar" : "Expandir"}
                  className="text-base-content/50 flex h-6 w-6 items-center justify-center transition-transform"
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{category.name}</span>
                </div>
                <Chip size="sm" variant="soft">
                  {catItems.length} items
                </Chip>
              </button>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button isIconOnly size="sm" variant="ghost">
                  <Edit2 size={14} />
                </Button>
                <Button
                  isIconOnly
                  className="text-error hover:bg-error/10"
                  onClick={() => {
                    onDeleteCategory(category.id);
                  }}
                  size="sm"
                  variant="ghost"
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
                    className="hover:bg-base-200/50 border-base-200/50 flex items-center gap-3 border-b py-3 pr-4 pl-14 last:border-b-0"
                    key={item.id}
                  >
                    <div className="bg-base-300/50 text-base-content/40 flex h-6 w-6 items-center justify-center rounded">
                      <Box size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-base-content/50 truncate text-xs">{item.description}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${getStockStatusColor(item.current_stock)}`}
                    >
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
              className="flex flex-1 items-center gap-3 text-left focus:outline-none"
              onClick={() => {
                toggleCategory(0);
              }}
              type="button"
            >
              <span
                aria-label={expandedCategories.has(0) ? "Colapsar" : "Expandir"}
                className="text-base-content/50 flex h-6 w-6 items-center justify-center"
              >
                {expandedCategories.has(0) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <div className="bg-base-300 text-base-content/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <Package size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-base-content/70 font-medium">Sin categoría</span>
              </div>
              <Chip size="sm" variant="soft">
                {uncategorizedItems.length} items
              </Chip>
            </button>
          </div>

          {expandedCategories.has(0) && (
            <div className="bg-base-200/30 border-base-200 border-t">
              {uncategorizedItems.map((item) => (
                <div
                  className="hover:bg-base-200/50 border-base-200/50 flex items-center gap-3 border-b py-3 pr-4 pl-14 last:border-b-0"
                  key={item.id}
                >
                  <div className="bg-base-300/50 text-base-content/40 flex h-6 w-6 items-center justify-center rounded">
                    <Box size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-base-content/50 truncate text-xs">{item.description}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${getStockStatusColor(item.current_stock)}`}
                  >
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
