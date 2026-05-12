import { Button, Description, Input, Label, TextField } from "@heroui/react";
import type React from "react";
import { useState } from "react";

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

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
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
        <span className="block font-bold text-lg">{item.name}</span>
        <Description className="text-default-500">Stock actual: {item.current_stock}</Description>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField isRequired onChange={setQuantityChange} type="number" value={quantityChange}>
          <Label>Cantidad a agregar/quitar</Label>
          <Input placeholder="Ej: 20 (agrega) o -15 (quita)" />
        </TextField>

        <TextField isRequired onChange={setReason} type="text" value={reason}>
          <Label>Razón del ajuste</Label>
          <Input placeholder="Ej: Compra inicial, uso en procedimiento" />
        </TextField>
      </div>
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button onPress={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button isDisabled={saving} type="submit" variant="primary">
          {saving ? "Guardando..." : "Ajustar Stock"}
        </Button>
      </div>
    </form>
  );
}
