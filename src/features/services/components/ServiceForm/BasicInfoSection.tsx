import type { ChangeEvent } from "react";
import Input from "../../../../components/ui/Input";
import type { ServiceFormState } from "../ServiceForm";

interface BasicInfoSectionProps {
  name: string;
  category?: string | null;
  detail?: string | null;
  notes?: string | null;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

export function BasicInfoSection({ name, category, detail, notes, onChange }: BasicInfoSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Input
        label="Nombre"
        value={name}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("name", event.target.value)}
        required
      />
      <Input
        label="Categoría"
        value={category ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("category", event.target.value)}
        helper="Ej: Servicios básicos, Marketing, Arriendo"
      />
      <Input
        label="Detalle"
        as="textarea"
        rows={3}
        value={detail ?? ""}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange("detail", event.target.value)}
        helper="Describe qué cubre el servicio o condiciones especiales"
      />
      <Input
        label="Notas"
        as="textarea"
        rows={3}
        value={notes ?? ""}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange("notes", event.target.value)}
      />
    </section>
  );
}
