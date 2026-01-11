import {
  useCreateInventoryItem,
  useCreateInventoryMovement,
  useFindManyInventoryItem,
  useUpdateInventoryItem,
} from "@finanzas/db/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, PlusCircle } from "lucide-react";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import AdjustStockForm from "@/features/inventory/components/AdjustStockForm";
import AllergyInventoryView from "@/features/inventory/components/AllergyInventoryView";
import InventoryItemForm from "@/features/inventory/components/InventoryItemForm";
import InventoryTable from "@/features/inventory/components/InventoryTable";
import type { InventoryItem, InventoryMovement } from "@/features/inventory/types";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";

export default function InventoryPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const canCreateItem = can("create", "InventoryItem");
  const canUpdateItem = can("update", "InventoryItem");
  // Adjusting stock creates a movement
  const canAdjustStock = can("create", "InventoryMovement");

  // ZenStack hooks for inventory items
  const {
    data: itemsData,
    isPending,
    isFetching,
    error: itemsError,
  } = useFindManyInventoryItem({
    include: { category: true },
    orderBy: { name: "asc" },
  });

  // Transform ZenStack camelCase to frontend snake_case
  type ZenStackItem = NonNullable<typeof itemsData>[number];
  const items: InventoryItem[] = (itemsData ?? []).map((item: ZenStackItem) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category_id: item.categoryId,
    current_stock: item.currentStock,
    category_name: (item as { category?: { name?: string } }).category?.name,
  }));

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

  // ZenStack mutations for CRUD
  // ZenStack mutations for CRUD
  const createItemMutation = useCreateInventoryItem();
  const updateItemMutation = useUpdateInventoryItem();
  const createMovementMutation = useCreateInventoryMovement();

  const saving = createItemMutation.isPending || updateItemMutation.isPending || createMovementMutation.isPending;

  async function handleSaveItem(itemData: Omit<InventoryItem, "id">) {
    setError(null);
    try {
      if (editingItem) {
        await updateItemMutation.mutateAsync({
          where: { id: editingItem.id },
          data: {
            name: itemData.name,
            description: itemData.description,
            categoryId: itemData.category_id,
            currentStock: itemData.current_stock,
          },
        });
        toastSuccess("Item actualizado");
      } else {
        // ZenStack uses camelCase field names
        await createItemMutation.mutateAsync({
          data: {
            name: itemData.name,
            description: itemData.description,
            categoryId: itemData.category_id,
            currentStock: itemData.current_stock ?? 0,
          },
        });
        toastSuccess("Item creado correctamente");
      }
      closeModal();
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "No se pudo guardar el item";
      setError(message);
      toastError(message);
    }
  }

  async function handleAdjustStock(movement: InventoryMovement) {
    setError(null);
    try {
      // ZenStack uses camelCase field names
      await createMovementMutation.mutateAsync({
        data: {
          itemId: movement.item_id,
          quantityChange: movement.quantity_change,
          reason: movement.reason,
        },
      });
      // Refetch items to get updated stock
      queryClient.invalidateQueries({ queryKey: ["inventoryItem"] });
      toastSuccess("Stock ajustado correctamente");
      closeModal();
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "No se pudo ajustar el stock";
      setError(message);
      toastError(message);
    }
  }

  const combinedError = error || (itemsError ? itemsError.message : null);

  return (
    <section className="space-y-8">
      <ServicesHero
        title="Inventario"
        description="Gestiona insumos, materiales y stock del centro con controles rápidos para crear y ajustar."
        actions={
          <Button
            onClick={openCreateModal}
            disabled={!canCreateItem}
            title={canCreateItem ? undefined : "Requiere permiso para crear ítems"}
          >
            {canCreateItem ? <PlusCircle size={16} /> : <Lock size={16} />}
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
          canUpdate={canUpdateItem}
          canAdjust={canAdjustStock}
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
