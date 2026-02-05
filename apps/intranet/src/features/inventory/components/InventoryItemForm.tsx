import type React from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";

import { getInventoryCategories } from "../api";
import type { InventoryCategory, InventoryItem } from "../types";

interface InventoryItemFormProps {
  item?: InventoryItem | null;
  onCancel: () => void;
  onSave: (item: Omit<InventoryItem, "id">) => void;
  saving: boolean;
}
export function InventoryItemForm({ item, onCancel, onSave, saving }: InventoryItemFormProps) {
  const [form, setForm] = useState({
    ...item,
    category_id: item?.category_id ?? null,
    current_stock: item?.current_stock ?? 0,
    description: item?.description ?? "",
  });
  const [categories, setCategories] = useState<InventoryCategory[]>([]);

  useEffect(() => {
    getInventoryCategories().then(setCategories).catch(console.error);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form as Omit<InventoryItem, "id">);
  };

  return (
    <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Nombre del item"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm({ ...form, name: event.target.value });
          }}
          required
          type="text"
          value={form.name ?? ""}
        />

        <Select
          label="Categoría"
          onChange={(key) => {
            setForm({
              ...form,
              category_id: key ? Number(key) : null,
            });
          }}
          value={form.category_id == null ? "" : String(form.category_id)}
        >
          <SelectItem key="">Sin categoría</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={String(cat.id)}>{cat.name}</SelectItem>
          ))}
        </Select>
      </div>
      <Input
        as="textarea"
        label="Descripción"
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          setForm({ ...form, description: event.target.value });
        }}
        rows={3}
        value={form.description ?? ""}
      />

      <Input
        disabled={Boolean(item)} // Disable if editing
        label="Stock inicial"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          setForm({ ...form, current_stock: Number(event.target.value) });
        }}
        required
        type="number"
        value={form.current_stock ?? 0}
      />

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={saving} type="submit" variant="primary">
          {saving ? "Guardando..." : "Guardar Item"}
        </Button>
      </div>
    </form>
  );
}
