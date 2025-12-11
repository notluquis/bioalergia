import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Trash2, Edit2, Loader2, ChevronDown, ChevronRight, Box } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";

type InventoryItem = {
  id: number;
  name: string;
  description: string | null;
  current_stock: number;
  category_id: number | null;
  category_name: string | null;
};

type Category = {
  id: number;
  name: string;
  created_at: string;
};

type CategoriesResponse = {
  status: string;
  data: Category[];
};

type ItemsResponse = {
  status: string;
  data: InventoryItem[];
};

export default function InventorySettingsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Fetch Categories
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: async () => {
      const res = await apiClient.get<CategoriesResponse>("/api/inventory/categories");
      return res.data;
    },
  });

  // Fetch Items
  const { data: itemsData, isLoading: isLoadingItems } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const res = await apiClient.get<ItemsResponse>("/api/inventory/items");
      return res.data;
    },
  });

  const isLoading = isLoadingCategories || isLoadingItems;

  // Group items by category
  const itemsByCategory = (itemsData ?? []).reduce(
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
    mutationFn: async (name: string) => {
      await apiClient.post("/api/inventory/categories", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      success("Categoría creada");
      setNewCategoryName("");
      setIsCreating(false);
    },
    onError: () => toastError("Error al crear categoría"),
  });

  // Delete Category Mutation (stub - backend support pending)
  // TODO: Implement backend DELETE /api/inventory/categories/:id endpoint
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // Backend doesn't have delete category endpoint yet
      console.warn("Delete category not implemented. Category ID:", id);
      throw new Error("Función no implementada en backend");
    },
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

  const categories = categoriesData ?? [];
  const uncategorizedItems = itemsByCategory[0] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base-content text-2xl font-bold">Inventario</h1>
          <p className="text-base-content/60 text-sm">Gestiona las categorías y productos del inventario.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus size={16} />
          Nueva Categoría
        </Button>
      </div>

      {isCreating && (
        <div className="surface-elevated animate-in fade-in slide-in-from-top-2 rounded-xl p-4">
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label py-1">
                <span className="label-text text-xs">Nombre de la categoría</span>
              </label>
              <Input
                autoFocus
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

      <div className="surface-elevated overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="text-base-content/50 py-8 text-center">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : categories.length === 0 && uncategorizedItems.length === 0 ? (
          <div className="text-base-content/50 py-8 text-center">No hay categorías ni items registrados.</div>
        ) : (
          <div className="divide-base-200 divide-y">
            {categories.map((category) => {
              const items = itemsByCategory[category.id] ?? [];
              const isExpanded = expandedCategories.has(category.id);

              return (
                <div key={category.id}>
                  {/* Category Row */}
                  <div
                    className="hover:bg-base-200/50 group flex cursor-pointer items-center gap-3 p-4"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <button
                      type="button"
                      className="text-base-content/50 flex h-6 w-6 items-center justify-center"
                      aria-label={isExpanded ? "Colapsar" : "Expandir"}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                      <Package size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <span className="badge badge-ghost badge-sm">{items.length} items</span>
                    <div
                      className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="sm" variant="ghost" className="btn-square btn-xs">
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="btn-square btn-xs text-error hover:bg-error/10"
                        onClick={() => {
                          if (confirm("¿Estás seguro de eliminar esta categoría?")) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Items List (Expanded) */}
                  {isExpanded && items.length > 0 && (
                    <div className="bg-base-200/30 border-base-200 border-t">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="hover:bg-base-200/50 border-base-200/50 flex items-center gap-3 border-b py-3 pr-4 pl-14 last:border-b-0"
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
                            className={`text-xs font-medium ${item.current_stock <= 0 ? "text-error" : item.current_stock < 10 ? "text-warning" : "text-success"}`}
                          >
                            Stock: {item.current_stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && items.length === 0 && (
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
                <div
                  className="hover:bg-base-200/50 group flex cursor-pointer items-center gap-3 p-4"
                  onClick={() => toggleCategory(0)}
                >
                  <button
                    type="button"
                    className="text-base-content/50 flex h-6 w-6 items-center justify-center"
                    aria-label={expandedCategories.has(0) ? "Colapsar" : "Expandir"}
                  >
                    {expandedCategories.has(0) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="bg-base-300 text-base-content/50 flex h-8 w-8 items-center justify-center rounded-lg">
                    <Package size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-base-content/70 font-medium">Sin categoría</span>
                  </div>
                  <span className="badge badge-ghost badge-sm">{uncategorizedItems.length} items</span>
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
                          {item.description && (
                            <p className="text-base-content/50 truncate text-xs">{item.description}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium ${item.current_stock <= 0 ? "text-error" : item.current_stock < 10 ? "text-warning" : "text-success"}`}
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
        )}
      </div>
    </div>
  );
}
