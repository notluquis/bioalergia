import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";

type Category = {
  id: number;
  name: string;
  _count: {
    items: number;
  };
};

export default function InventorySettingsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Fetch Categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: async () => {
      // Mock for now, replace with actual API call
      // const res = await fetch("/api/inventory/categories");
      // if (!res.ok) throw new Error("Failed to fetch categories");
      // return res.json();
      return [
        { id: 1, name: "Medicamentos", _count: { items: 12 } },
        { id: 2, name: "Insumos Médicos", _count: { items: 45 } },
        { id: 3, name: "Oficina", _count: { items: 8 } },
      ] as Category[];
    },
  });

  // Create Category Mutation
  const createMutation = useMutation({
    mutationFn: async (_name: string) => {
      void _name;
      // await fetch("/api/inventory/categories", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ name }),
      // });
      await new Promise((resolve) => setTimeout(resolve, 500)); // Mock delay
    },
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
    mutationFn: async (_id: number) => {
      void _id;
      // await fetch(`/api/inventory/categories/${id}`, { method: "DELETE" });
      await new Promise((resolve) => setTimeout(resolve, 500)); // Mock delay
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      success("Categoría eliminada");
    },
    onError: () => toastError("Error al eliminar categoría"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    createMutation.mutate(newCategoryName);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Inventario</h1>
          <p className="text-sm text-base-content/60">Gestiona las categorías de productos.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus size={16} />
          Nueva Categoría
        </Button>
      </div>

      {isCreating && (
        <div className="surface-elevated p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
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

      <div className="surface-elevated rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Nombre</th>
                <th className="text-center">Items</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-base-content/50">
                    <Loader2 className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : categories?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-base-content/50">
                    No hay categorías registradas.
                  </td>
                </tr>
              ) : (
                categories?.map((category) => (
                  <tr key={category.id} className="hover:bg-base-200/50 group">
                    <td>
                      <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50">
                        <Package size={16} />
                      </div>
                    </td>
                    <td className="font-medium">{category.name}</td>
                    <td className="text-center">
                      <span className="badge badge-ghost badge-sm">{category._count.items} items</span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
