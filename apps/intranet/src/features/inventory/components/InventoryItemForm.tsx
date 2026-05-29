import {
  Button,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type React from "react";
import { useEffect, useState } from "react";

import { getInventoryCategories } from "../api";
import type { InventoryCategory, InventoryItem } from "../types";

interface InventoryItemFormProps {
  item?: InventoryItem | null;
  onCancel: () => void;
  onSave: (item: Omit<InventoryItem, "id">) => void;
  saving: boolean;
}
export function InventoryItemForm({ item, onCancel, onSave, saving }: InventoryItemFormProps) {
  const NO_CATEGORY_KEY = "__no_inventory_category__";
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

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(form as Omit<InventoryItem, "id">);
  };

  return (
    <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          isRequired
          onChange={(v) => setForm({ ...form, name: v })}
          type="text"
          value={form.name ?? ""}
        >
          <Label>Nombre del item</Label>
          <Input />
        </TextField>

        <Select
          onChange={(key) => {
            setForm({
              ...form,
              category_id: key && key !== NO_CATEGORY_KEY ? Number(key) : null,
            });
          }}
          value={form.category_id == null ? NO_CATEGORY_KEY : String(form.category_id)}
        >
          <Label>Categoría</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={NO_CATEGORY_KEY} key={NO_CATEGORY_KEY}>
                Sin categoría
              </ListBox.Item>
              {categories.map((cat) => (
                <ListBox.Item id={String(cat.id)} key={String(cat.id)}>
                  {cat.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <TextField
        onChange={(v) => setForm({ ...form, description: v })}
        value={form.description ?? ""}
      >
        <Label>Descripción</Label>
        <TextArea rows={3} />
      </TextField>

      <NumberField
        isDisabled={Boolean(item)}
        isRequired
        minValue={0}
        onChange={(v) => setForm({ ...form, current_stock: v ?? 0 })}
        step={1}
        value={form.current_stock ?? 0}
      >
        <Label>Stock inicial</Label>
        <NumberField.Group className="grid-cols-1">
          <NumberField.Input />
        </NumberField.Group>
      </NumberField>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button onPress={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button isDisabled={saving} type="submit" variant="primary">
          {saving ? "Guardando..." : "Guardar Item"}
        </Button>
      </div>
    </form>
  );
}
