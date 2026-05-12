import { Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import type { ChangeEvent } from "react";
import { z } from "zod";
import { GRID_2_COL_MD } from "@/lib/styles";
import type { ServiceFormState } from "../ServiceForm";
import { CreatableSelectField } from "./CreatableSelectField";

interface BasicInfoSectionProps {
  category?: null | string;
  categoryOptions: Array<{ id: string; label: string }>;
  detail?: null | string;
  name: string;
  notes?: null | string;
  reminderDaysBefore: number;
  transactionCategories: Array<{
    color?: null | string;
    id: number;
    name: string;
  }>;
  transactionCategoryId?: null | number;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  onCreateCategory: (value: string) => void;
}

export function BasicInfoSection({
  category,
  categoryOptions,
  detail,
  name,
  notes,
  reminderDaysBefore,
  transactionCategories,
  transactionCategoryId,
  onChange,
  onCreateCategory,
}: BasicInfoSectionProps) {
  return (
    <section className={GRID_2_COL_MD}>
      <TextField isRequired>
        <Label>Nombre</Label>
        <Input
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange("name", event.target.value);
          }}
          value={name}
        />
      </TextField>

      <CreatableSelectField
        createButtonLabel="+ Nueva categoría"
        createSchema={z.string().min(1, "La categoría es obligatoria").max(50)}
        description="Ej: Utilidades, Marketing, Arriendo"
        label="Categoría"
        options={categoryOptions}
        placeholder="Selecciona o crea una categoría"
        value={category || null}
        onChange={(value) => {
          onChange("category", value);
        }}
        onCreateNew={(newCategory) => {
          onCreateCategory(newCategory);
        }}
      />

      <Select
        onChange={(value) => {
          if (!value) {
            onChange("transactionCategoryId", null);
            return;
          }
          onChange("transactionCategoryId", Number(value));
        }}
        value={transactionCategoryId == null ? "__none__" : String(transactionCategoryId)}
      >
        <Label>Categoría financiera</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="__none__" key="__none__">
              Sin categoría financiera
            </ListBox.Item>
            {transactionCategories.map((categoryOption) => (
              <ListBox.Item id={String(categoryOption.id)} key={categoryOption.id}>
                {categoryOption.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField type="number">
        <Label>Recordar (días antes)</Label>
        <Input
          max={90}
          min={0}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange("reminderDaysBefore", Number(event.target.value || 0));
          }}
          value={String(reminderDaysBefore)}
        />
      </TextField>

      <TextField>
        <Label>Detalle</Label>
        <TextArea
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange("detail", event.target.value);
          }}
          placeholder="Describe qué cubre el servicio o condiciones especiales"
          rows={3}
          value={detail ?? ""}
        />
      </TextField>

      <TextField>
        <Label>Notas</Label>
        <TextArea
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange("notes", event.target.value);
          }}
          rows={3}
          value={notes ?? ""}
        />
      </TextField>
    </section>
  );
}
