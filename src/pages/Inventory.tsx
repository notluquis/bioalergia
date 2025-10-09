import { useEffect, useState } from "react";
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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForStockAdjust, setItemForStockAdjust] = useState<InventoryItem | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const data = await getInventoryItems();
      setItems(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el inventario";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleSaveItem(itemData: Omit<InventoryItem, "id">) {
    setSaving(true);
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, itemData);
      } else {
        await createInventoryItem(itemData);
      }
      closeModal();
      await loadItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el item";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjustStock(movement: InventoryMovement) {
    setSaving(true);
    try {
      await createInventoryMovement(movement);
      closeModal();
      await loadItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo ajustar el stock";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Inventario</h1>
          <p className="max-w-2xl text-sm text-slate-600">Gestiona los insumos, materiales y stock de la clínica.</p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusCircle size={16} />
          Agregar Item
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <InventoryTable
        items={items}
        loading={loading}
        openAdjustStockModal={openAdjustStockModal}
        openEditModal={openEditModal}
      />

      <Modal isOpen={isItemModalOpen} onClose={closeModal} title={editingItem ? "Editar Item" : "Agregar Nuevo Item"}>
        <InventoryItemForm item={editingItem} onSave={handleSaveItem} onCancel={closeModal} saving={saving} />
      </Modal>

      {itemForStockAdjust && (
        <Modal isOpen={isAdjustStockModalOpen} onClose={closeModal} title="Ajustar Stock">
          <AdjustStockForm item={itemForStockAdjust} onSave={handleAdjustStock} onCancel={closeModal} saving={saving} />
        </Modal>
      )}
    </section>
  );
}
