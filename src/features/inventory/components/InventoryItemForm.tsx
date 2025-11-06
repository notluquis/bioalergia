import React, { useEffect, useState } from "react";
import { InventoryCategory, InventoryItem } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import { getInventoryCategories } from "../api";

interface InventoryItemFormProps {
  item?: InventoryItem | null;
  onSave: (item: Omit<InventoryItem, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function InventoryItemForm({ item, onSave, onCancel, saving }: InventoryItemFormProps) {
  const [form, setForm] = useState({
    ...item,
    category_id: item?.category_id ?? null,
    description: item?.description ?? "",
    current_stock: item?.current_stock ?? 0,
  });
  const [categories, setCategories] = useState<InventoryCategory[]>([]);

  useEffect(() => {
    getInventoryCategories().then(setCategories);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form as Omit<InventoryItem, "id">);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Nombre del item"
          type="text"
          value={form.name ?? ""}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: event.target.value })}
          required
        />
        <Input
          label="Categoría"
          type="select"
          value={form.category_id != null ? String(form.category_id) : ""}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            setForm({ ...form, category_id: event.target.value ? Number(event.target.value) : null })
          }
        >
          <option value="">Sin categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Input>
      </div>
      <Input
        label="Descripción"
        type="textarea"
        rows={3}
        value={form.description ?? ""}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          setForm({ ...form, description: event.target.value })
        }
      />
      <Input
        label="Stock inicial"
        type="number"
        value={form.current_stock ?? 0}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setForm({ ...form, current_stock: Number(event.target.value) })
        }
        required
        disabled={!!item} // Disable if editing
      />
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Guardando..." : "Guardar Item"}
        </Button>
      </div>
    </form>
  );
}
