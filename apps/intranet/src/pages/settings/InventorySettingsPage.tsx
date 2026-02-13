import { Card, Chip } from "@heroui/react";
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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { createInventoryCategory, deleteInventoryCategory } from "@/features/inventory/api";
import { inventoryKeys } from "@/features/inventory/queries";
import type { InventoryItem } from "@/features/inventory/types";

const getStockStatusColor = (stock: number) => {
  if (stock <= 0) {
    return "text-danger";
  }
  if (stock < 10) {
    return "text-warning";
  }
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
export function InventorySettingsPage() {
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
    if (!acc[catId]) {
      acc[catId] = [];
    }
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

  const handleCreate = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      return;
    }
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
        <Card.Header className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <Card.Title>Parámetros de inventario</Card.Title>
            <Card.Description>Gestiona las categorías y productos del inventario.</Card.Description>
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
        </Card.Header>
        <Card.Content className="p-0">
          {isCreating && (
            <div className="fade-in slide-in-from-top-2 animate-in border-b bg-default-50/30 p-4">
              <form className="flex items-end gap-3" onSubmit={handleCreate}>
                <div className="flex-1">
                  <Input
                    containerClassName="gap-1"
                    id="category-name"
                    label="Nombre de la categoría"
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
        </Card.Content>
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
      <div className="py-12 text-center text-default-400">
        <Loader2 className="mx-auto animate-spin" />
      </div>
    );
  }

  if (categories.length === 0 && uncategorizedItems.length === 0) {
    return (
      <div className="py-12 text-center text-default-400">
        No hay categorías ni items registrados.
      </div>
    );
  }

  return (
    <div className="divide-y divide-base-200 border-t">
      {categories.map((category) => {
        const catItems = itemsByCategory[category.id] ?? [];
        const isExpanded = expandedCategories.has(category.id);

        return (
          <div key={category.id}>
            {/* Category Row */}
            <div className="group flex items-center gap-3 p-4 transition-colors hover:bg-default-50/50">
              <Button
                className="flex flex-1 items-center gap-3 text-left focus:outline-none"
                onPress={() => {
                  toggleCategory(category.id);
                }}
                type="button"
                aria-label={isExpanded ? "Colapsar" : "Expandir"}
                variant="ghost"
              >
                <span className="flex h-6 w-6 items-center justify-center text-default-400 transition-transform">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{category.name}</span>
                </div>
                <Chip size="sm" variant="soft">
                  {catItems.length} items
                </Chip>
              </Button>
              <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-70 sm:group-hover:opacity-100">
                <Button isIconOnly size="sm" variant="ghost">
                  <Edit2 size={14} />
                </Button>
                <Button
                  isIconOnly
                  className="text-danger hover:bg-danger/10"
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
              <div className="border-default-100 border-t bg-default-50/30">
                {catItems.map((item) => (
                  <div
                    className="flex items-center gap-3 border-default-100/50 border-b py-3 pr-4 pl-14 last:border-b-0 hover:bg-default-50/50"
                    key={item.id}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-default-100/50 text-default-300">
                      <Box size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">{item.name}</span>
                      {item.description && (
                        <span className="block truncate text-default-400 text-xs">
                          {item.description}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-medium text-xs ${getStockStatusColor(item.current_stock)}`}
                    >
                      Stock: {item.current_stock}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && catItems.length === 0 && (
              <div className="border-default-100 border-t bg-default-50/30 py-4 pl-14 text-default-400 text-sm italic">
                Sin items en esta categoría
              </div>
            )}
          </div>
        );
      })}

      {/* Uncategorized Items */}
      {uncategorizedItems.length > 0 && (
        <div>
          <div className="group flex items-center gap-3 p-4 transition-colors hover:bg-default-50/50">
            <Button
              className="flex flex-1 items-center gap-3 text-left focus:outline-none"
              onPress={() => {
                toggleCategory(0);
              }}
              type="button"
              aria-label={expandedCategories.has(0) ? "Colapsar" : "Expandir"}
              variant="ghost"
            >
              <span className="flex h-6 w-6 items-center justify-center text-default-400">
                {expandedCategories.has(0) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-400">
                <Package size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-default-600">Sin categoría</span>
              </div>
              <Chip size="sm" variant="soft">
                {uncategorizedItems.length} items
              </Chip>
            </Button>
          </div>

          {expandedCategories.has(0) && (
            <div className="border-default-100 border-t bg-default-50/30">
              {uncategorizedItems.map((item) => (
                <div
                  className="flex items-center gap-3 border-default-100/50 border-b py-3 pr-4 pl-14 last:border-b-0 hover:bg-default-50/50"
                  key={item.id}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-default-100/50 text-default-300">
                    <Box size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">{item.name}</span>
                    {item.description && (
                      <span className="block truncate text-default-400 text-xs">
                        {item.description}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-medium text-xs ${getStockStatusColor(item.current_stock)}`}
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
