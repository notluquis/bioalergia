import { Alert, Button, Modal, Surface } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Lock, PlusCircle } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  createInventoryItem,
  createInventoryMovement,
  updateInventoryItem,
} from "@/features/inventory/api";
import { AdjustStockForm } from "@/features/inventory/components/AdjustStockForm";
import { AllergyInventoryView } from "@/features/inventory/components/AllergyInventoryView";
import { columns } from "@/features/inventory/components/columns";
import { InventoryItemForm } from "@/features/inventory/components/InventoryItemForm";
import { inventoryKeys } from "@/features/inventory/queries";
import type { InventoryItem, InventoryMovement } from "@/features/inventory/types";
export function InventoryPage() {
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

  const createItemMutation = useMutation({
    mutationFn: (itemData: Omit<InventoryItem, "id">) => createInventoryItem(itemData),
  });
  const updateItemMutation = useMutation({
    mutationFn: ({ id, item }: { id: number; item: Partial<Omit<InventoryItem, "id">> }) =>
      updateInventoryItem(id, item),
  });
  const createMovementMutation = useMutation({
    mutationFn: (movement: InventoryMovement) => createInventoryMovement(movement),
  });

  const saving =
    createItemMutation.isPending ||
    updateItemMutation.isPending ||
    createMovementMutation.isPending;

  async function handleSaveItem(itemData: Omit<InventoryItem, "id">) {
    setError(null);
    try {
      if (editingItem) {
        await updateItemMutation.mutateAsync({ id: editingItem.id, item: itemData });
        toastSuccess("Item actualizado");
      } else {
        await createItemMutation.mutateAsync(itemData);
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
      await createMovementMutation.mutateAsync(movement);
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
      {combinedError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>{combinedError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Surface className="space-y-6 rounded-[28px] p-6 shadow-inner">
        <div className="mb-4 flex justify-end">
          <Button
            className="w-full sm:w-auto"
            isDisabled={!canCreateItem}
            onPress={openCreateModal}
          >
            {canCreateItem ? <PlusCircle size={16} /> : <Lock size={16} />}
            Agregar item
          </Button>
        </div>
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
          scrollMaxHeight="min(68dvh, 760px)"
        />
      </Surface>

      <AllergyInventoryView />

      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen={isItemModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeModal();
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>{editingItem ? "Editar item" : "Agregar nuevo item"}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                <InventoryItemForm
                  item={editingItem}
                  onCancel={closeModal}
                  onSave={(...args) => {
                    void handleSaveItem(...args);
                  }}
                  saving={saving}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {itemForStockAdjust && (
        <Modal>
          <Modal.Backdrop
            className="bg-black/40 backdrop-blur-[2px]"
            isOpen={isAdjustStockModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeModal();
              }
            }}
          >
            <Modal.Container placement="center">
              <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
                <Modal.Header className="mb-4 font-bold text-primary text-xl">
                  <Modal.Heading>Ajustar stock</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                  <AdjustStockForm
                    item={itemForStockAdjust}
                    onCancel={closeModal}
                    onSave={(...args) => {
                      void handleAdjustStock(...args);
                    }}
                    saving={saving}
                  />
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </section>
  );
}
