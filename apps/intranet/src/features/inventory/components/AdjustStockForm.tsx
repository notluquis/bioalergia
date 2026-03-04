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
        <TextField isRequired type="number">
          <Label>Cantidad a agregar/quitar</Label>
          <Input
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setQuantityChange(event.target.value);
            }}
            placeholder="Ej: 20 (agrega) o -15 (quita)"
            value={quantityChange}
          />
        </TextField>

        <TextField isRequired type="text">
          <Label>Razón del ajuste</Label>
          <Input
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setReason(event.target.value);
            }}
            placeholder="Ej: Compra inicial, uso en procedimiento"
            value={reason}
          />
        </TextField>
      </div>
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button isDisabled={saving} type="submit" variant="primary">
          {saving ? "Guardando..." : "Ajustar Stock"}
        </Button>
      </div>
    </form>
  );
}
