import type { ChangeEvent } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { SelectWithCreateNew } from "@/components/ui/SelectWithCreateNew";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { ServiceFormState } from "../ServiceForm";

interface BasicInfoSectionProps {
  category?: null | string;
  categoryOptions: Array<{ id: string; label: string }>;
  detail?: null | string;
  name: string;
  notes?: null | string;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  onCreateCategory: (value: string) => void;
}

export function BasicInfoSection({
  category,
  categoryOptions,
  detail,
  name,
  notes,
  onChange,
  onCreateCategory,
}: BasicInfoSectionProps) {
  return (
    <section className={GRID_2_COL_MD}>
      <Input
        label="Nombre"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("name", event.target.value);
        }}
        required
        value={name}
      />

      <SelectWithCreateNew
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

      <Input
        as="textarea"
        helper="Describe qué cubre el servicio o condiciones especiales"
        label="Detalle"
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange("detail", event.target.value);
        }}
        rows={3}
        value={detail ?? ""}
      />

      <Input
        as="textarea"
        label="Notas"
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange("notes", event.target.value);
        }}
        rows={3}
        value={notes ?? ""}
      />
    </section>
  );
}
