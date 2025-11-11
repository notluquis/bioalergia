import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  createInventoryMovement,
} from "../features/inventory/api";
import type { InventoryItem, InventoryMovement } from "../features/inventory/types";
import { PlusCircle } from "lucide-react";
import Modal from "../components/Modal";
import InventoryItemForm from "../features/inventory/components/InventoryItemForm";
import AdjustStockForm from "../features/inventory/components/AdjustStockForm";
import InventoryTable from "../features/inventory/components/InventoryTable";
import Alert from "../components/Alert";
import Button from "../components/Button";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { ServicesHero, ServicesSurface } from "../features/services/components/ServicesShell";
import AllergyInventoryView from "../features/inventory/components/AllergyInventoryView";

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const {
    data: itemsData,
    isPending,
    isFetching,
    error: itemsError,
  } = useQuery<InventoryItem[], Error>({
    queryKey: queryKeys.inventory.items(),
    queryFn: getInventoryItems,
    staleTime: 2 * 60 * 1000,
  });
  const items = itemsData ?? [];

  const [error, setError] = useState<string | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForStockAdjust, setItemForStockAdjust] = useState<InventoryItem | null>(null);

  const loading = isPending || isFetching;

  function openCreateModal() {
    setEditingItem(null);
    setIsItemModalOpen(true);
  }

  function openEditModal(item: InventoryItem) {
    setEditingItem(item);
    setIsItemModalOpen(true);
  }

  function openAdjustStockModal(item: InventoryItem) {
    setItemForStockAdjust(item);
    setIsAdjustStockModalOpen(true);
  }

  function closeModal() {
    setIsItemModalOpen(false);
    setEditingItem(null);
    setIsAdjustStockModalOpen(false);
    setItemForStockAdjust(null);
  }

  const createItemMutation = useMutation<
    InventoryItem,
    Error,
    Omit<InventoryItem, "id">,
    { previousItems?: InventoryItem[]; optimisticId?: number }
  >({
    mutationFn: createInventoryItem,
    onMutate: async (newItem) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.inventory.items() });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(queryKeys.inventory.items());
      const optimisticItem: InventoryItem = {
        id: Date.now() * -1,
        ...newItem,
      };
      queryClient.setQueryData<InventoryItem[]>(queryKeys.inventory.items(), (old = []) => [...old, optimisticItem]);
      return { previousItems, optimisticId: optimisticItem.id };
    },
    onError: (err, _variables, context) => {
      const message = err.message || "No se pudo guardar el item";
      setError(message);
      toastError(message);
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.inventory.items(), context.previousItems);
      }
    },
    onSuccess: (createdItem, _variables, context) => {
      queryClient.setQueryData<InventoryItem[]>(queryKeys.inventory.items(), (old = []) =>
        old.map((item) => (item.id === context?.optimisticId ? createdItem : item))
      );
      toastSuccess("Item creado correctamente");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.items() });
    },
  });

  const updateItemMutation = useMutation<
    InventoryItem,
    Error,
    { id: number; data: Partial<Omit<InventoryItem, "id">> },
    { previousItems?: InventoryItem[] }
  >({
    mutationFn: ({ id, data }) => updateInventoryItem(id, data),
    onMutate: async ({ id, data }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.inventory.items() });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(queryKeys.inventory.items());
      queryClient.setQueryData<InventoryItem[]>(queryKeys.inventory.items(), (old = []) =>
        old.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { previousItems };
    },
    onError: (err, _variables, context) => {
      const message = err.message || "No se pudo actualizar el item";
      setError(message);
      toastError(message);
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.inventory.items(), context.previousItems);
      }
    },
    onSuccess: () => {
      toastSuccess("Item actualizado");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.items() });
    },
  });

  const adjustStockMutation = useMutation<void, Error, InventoryMovement, { previousItems?: InventoryItem[] }>({
    mutationFn: createInventoryMovement,
    onMutate: async (movement) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.inventory.items() });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(queryKeys.inventory.items());
      queryClient.setQueryData<InventoryItem[]>(queryKeys.inventory.items(), (old = []) =>
        old.map((item) =>
          item.id === movement.item_id
            ? { ...item, current_stock: item.current_stock + movement.quantity_change }
            : item
        )
      );
      return { previousItems };
    },
    onError: (err, _variables, context) => {
      const message = err.message || "No se pudo ajustar el stock";
      setError(message);
      toastError(message);
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.inventory.items(), context.previousItems);
      }
    },
    onSuccess: () => {
      toastSuccess("Stock ajustado correctamente");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.items() });
    },
  });

  const saving = createItemMutation.isPending || updateItemMutation.isPending || adjustStockMutation.isPending;

  async function handleSaveItem(itemData: Omit<InventoryItem, "id">) {
    try {
      if (editingItem) {
        await updateItemMutation.mutateAsync({ id: editingItem.id, data: itemData });
      } else {
        await createItemMutation.mutateAsync(itemData);
      }
      closeModal();
    } catch {
      // Error handled in mutations
    }
  }

  async function handleAdjustStock(movement: InventoryMovement) {
    try {
      await adjustStockMutation.mutateAsync(movement);
      closeModal();
    } catch {
      // Error handled in mutation
    }
  }

  const combinedError = error || (itemsError ? itemsError.message : null);

  return (
    <section className="space-y-8">
      <ServicesHero
        title="Inventario"
        description="Gestiona insumos, materiales y stock del centro con controles rápidos para crear y ajustar."
        actions={
          <Button onClick={openCreateModal}>
            <PlusCircle size={16} />
            Agregar item
          </Button>
        }
      />

      {combinedError && <Alert variant="error">{combinedError}</Alert>}

      <ServicesSurface>
        <InventoryTable
          items={items}
          loading={loading}
          openAdjustStockModal={openAdjustStockModal}
          openEditModal={openEditModal}
        />
      </ServicesSurface>

      <AllergyInventoryView />

      <Modal isOpen={isItemModalOpen} onClose={closeModal} title={editingItem ? "Editar item" : "Agregar nuevo item"}>
        <InventoryItemForm item={editingItem} onSave={handleSaveItem} onCancel={closeModal} saving={saving} />
      </Modal>

      {itemForStockAdjust && (
        <Modal isOpen={isAdjustStockModalOpen} onClose={closeModal} title="Ajustar stock">
          <AdjustStockForm item={itemForStockAdjust} onSave={handleAdjustStock} onCancel={closeModal} saving={saving} />
        </Modal>
      )}
    </section>
  );
}
