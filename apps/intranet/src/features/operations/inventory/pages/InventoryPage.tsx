import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { Lock, PlusCircle } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AdjustStockForm } from "@/features/inventory/components/AdjustStockForm";
import { AllergyInventoryView } from "@/features/inventory/components/AllergyInventoryView";
import { columns } from "@/features/inventory/components/columns";
import { InventoryItemForm } from "@/features/inventory/components/InventoryItemForm";
import { inventoryKeys } from "@/features/inventory/queries";
import type { InventoryItem, InventoryMovement } from "@/features/inventory/types";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
export function InventoryPage() {
  const client = useClientQueries(schemaLite);

  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { error: toastError, success: toastSuccess } = useToast();

  const canCreateItem = can("create", "InventoryItem");
  const canUpdateItem = can("update", "InventoryItem");
  // Adjusting stock creates a movement
  const canAdjustStock = can("create", "InventoryMovement");

  // Modernized Query
  const { data: items } = useSuspenseQuery(inventoryKeys.items());

  const [error, setError] = useState<null | string>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForStockAdjust, setItemForStockAdjust] = useState<InventoryItem | null>(null);

  const loading = false; // Suspense handles initial load; mutations handle background states if needed

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
  const createItemMutation = client.inventoryItem.useCreate();
  const updateItemMutation = client.inventoryItem.useUpdate();
  const createMovementMutation = client.inventoryMovement.useCreate();

  const saving =
    createItemMutation.isPending ||
    updateItemMutation.isPending ||
    createMovementMutation.isPending;

  async function handleSaveItem(itemData: Omit<InventoryItem, "id">) {
    setError(null);
    try {
      if (editingItem) {
        await updateItemMutation.mutateAsync({
          data: {
            categoryId: itemData.category_id,
            currentStock: itemData.current_stock,
            description: itemData.description,
            name: itemData.name,
          },
          where: { id: editingItem.id },
        });
        toastSuccess("Item actualizado");
      } else {
        // ZenStack uses camelCase field names
        await createItemMutation.mutateAsync({
          data: {
            categoryId: itemData.category_id,
            currentStock: itemData.current_stock,
            description: itemData.description,
            name: itemData.name,
          },
        });
        toastSuccess("Item creado correctamente");
      }
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.items().queryKey });
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
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.items().queryKey });
      toastSuccess("Stock ajustado correctamente");
      closeModal();
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "No se pudo ajustar el stock";
      setError(message);
      toastError(message);
    }
  }

  const combinedError = error;

  return (
    <section className="space-y-8">
      <ServicesHero
        actions={
          <Button
            className="w-full sm:w-auto"
            disabled={!canCreateItem}
            onClick={openCreateModal}
            title={canCreateItem ? undefined : "Requiere permiso para crear ítems"}
          >
            {canCreateItem ? <PlusCircle size={16} /> : <Lock size={16} />}
            Agregar item
          </Button>
        }
        description="Gestiona insumos, materiales y stock del centro con controles rápidos para crear y ajustar."
        title="Inventario"
      />

      {combinedError && <Alert status="danger">{combinedError}</Alert>}

      <ServicesSurface>
        <DataTable
          columns={columns}
          data={items}
          containerVariant="plain"
          enablePagination={false}
          enableVirtualization
          isLoading={loading}
          meta={{
            canAdjust: canAdjustStock,
            canUpdate: canUpdateItem,
            openAdjustStockModal,
            openEditModal,
          }}
        />
      </ServicesSurface>

      <AllergyInventoryView />

      <Modal
        isOpen={isItemModalOpen}
        onClose={closeModal}
        title={editingItem ? "Editar item" : "Agregar nuevo item"}
      >
        <InventoryItemForm
          item={editingItem}
          onCancel={closeModal}
          onSave={handleSaveItem}
          saving={saving}
        />
      </Modal>

      {itemForStockAdjust && (
        <Modal isOpen={isAdjustStockModalOpen} onClose={closeModal} title="Ajustar stock">
          <AdjustStockForm
            item={itemForStockAdjust}
            onCancel={closeModal}
            onSave={handleAdjustStock}
            saving={saving}
          />
        </Modal>
      )}
    </section>
  );
}
