import type { ChangeEvent } from "react";

import Input from "@/components/ui/Input";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { ServiceFormState } from "../ServiceForm";

interface BasicInfoSectionProps {
  category?: null | string;
  detail?: null | string;
  name: string;
  notes?: null | string;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

export function BasicInfoSection({
  category,
  detail,
  name,
  notes,
  onChange,
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
      <Input
        helper="Ej: Servicios básicos, Marketing, Arriendo"
        label="Categoría"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("category", event.target.value);
        }}
        value={category ?? ""}
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
