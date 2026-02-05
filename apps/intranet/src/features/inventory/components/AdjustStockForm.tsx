import type React from "react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import type { InventoryItem, InventoryMovement } from "../types";

interface AdjustStockFormProps {
  item: InventoryItem;
  onCancel: () => void;
  onSave: (movement: InventoryMovement) => void;
  saving: boolean;
}
export function AdjustStockForm({ item, onCancel, onSave, saving }: AdjustStockFormProps) {
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
    <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
      <div>
        <h3 className="font-bold text-lg">{item.name}</h3>
        <p className="text-default-500">Stock actual: {item.current_stock}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Cantidad a agregar/quitar"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setQuantityChange(event.target.value);
          }}
          placeholder="Ej: 20 (agrega) o -15 (quita)"
          required
          type="number"
          value={quantityChange}
        />

        <Input
          label="Razón del ajuste"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setReason(event.target.value);
          }}
          placeholder="Ej: Compra inicial, uso en procedimiento"
          required
          type="text"
          value={reason}
        />
      </div>
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={saving} type="submit" variant="primary">
          {saving ? "Guardando..." : "Ajustar Stock"}
        </Button>
      </div>
    </form>
  );
}
