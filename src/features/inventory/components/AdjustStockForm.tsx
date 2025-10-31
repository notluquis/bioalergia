import { useState } from "react";
import { InventoryItem, InventoryMovement } from "../types";
import Button from "../../../components/Button";

interface AdjustStockFormProps {
  item: InventoryItem;
  onSave: (movement: InventoryMovement) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function AdjustStockForm({ item, onSave, onCancel, saving }: AdjustStockFormProps) {
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      item_id: item.id,
      quantity_change: Number(quantityChange),
      reason,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div>
        <h3 className="font-bold text-lg">{item.name}</h3>
        <p className="text-slate-500">Stock actual: {item.current_stock}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cantidad a agregar/quitar
          <input
            type="number"
            value={quantityChange}
            onChange={(e) => setQuantityChange(e.target.value)}
            required
            className="rounded border px-3 py-2"
            placeholder="Ej: 20 (agrega) o -15 (quita)"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Razón del ajuste
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="rounded border px-3 py-2"
            placeholder="Ej: Compra inicial, uso en procedimiento"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Guardando..." : "Ajustar Stock"}
        </Button>
      </div>
    </form>
  );
}
