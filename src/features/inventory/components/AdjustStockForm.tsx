import React, { useState } from "react";
import { InventoryItem, InventoryMovement } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";

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
        <p className="text-base-content/60">Stock actual: {item.current_stock}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Cantidad a agregar/quitar"
          type="number"
          value={quantityChange}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuantityChange(event.target.value)}
          required
          placeholder="Ej: 20 (agrega) o -15 (quita)"
        />
        <Input
          label="Razón del ajuste"
          type="text"
          value={reason}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReason(event.target.value)}
          required
          placeholder="Ej: Compra inicial, uso en procedimiento"
        />
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
