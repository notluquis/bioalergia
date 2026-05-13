import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import {
  TanStackInputField,
  TanStackSelectField,
  TanStackTextAreaField,
} from "./TanStackFieldControls";

const meta: Meta = {
  title: "Forms/TanStackFieldControls",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Wrappers de HeroUI v3 (`TextField`, `TextArea`, `Select`) integrados con TanStack Form. Cada wrapper lee `field.state.value` y `field.state.meta.errors` y propaga `handleChange` / `handleBlur`. Se demuestran los tres tipos con sus estados habituales: vacío, deshabilitado, con error de validación y con descripción.",
      },
    },
  },
};

export default meta;

type Story = StoryObj;

const inputSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
});

function InputDemo({
  defaultValue = "",
  description,
  withError = false,
}: {
  defaultValue?: string;
  description?: string;
  withError?: boolean;
}) {
  const form = useForm({
    defaultValues: { name: defaultValue },
    validators: { onChange: withError ? inputSchema : undefined },
  });
  return (
    <div className="max-w-sm">
      <form.Field name="name">
        {(field) => (
          <TanStackInputField
            description={description}
            field={field}
            label="Nombre"
            placeholder="Ej. Lucas"
            required
          />
        )}
      </form.Field>
    </div>
  );
}

export const InputDefault: Story = { render: () => <InputDemo /> };

export const InputWithDescription: Story = {
  render: () => <InputDemo description="Tu nombre legal completo" defaultValue="Lucas" />,
};

export const InputWithError: Story = { render: () => <InputDemo defaultValue="Lu" withError /> };

const textAreaSchema = z.object({
  notes: z.string().min(10, "Mínimo 10 caracteres"),
});

function TextAreaDemo({
  defaultValue = "",
  withError = false,
}: {
  defaultValue?: string;
  withError?: boolean;
}) {
  const form = useForm({
    defaultValues: { notes: defaultValue },
    validators: { onChange: withError ? textAreaSchema : undefined },
  });
  return (
    <div className="max-w-md">
      <form.Field name="notes">
        {(field) => (
          <TanStackTextAreaField
            field={field}
            label="Notas"
            placeholder="Información adicional..."
            rows={4}
          />
        )}
      </form.Field>
    </div>
  );
}

export const TextAreaDefault: Story = { render: () => <TextAreaDemo /> };

export const TextAreaWithError: Story = {
  render: () => <TextAreaDemo defaultValue="corto" withError />,
};

const SELECT_OPTIONS = [
  { label: "Proveedor", value: "SUPPLIER" },
  { label: "Cliente", value: "CLIENT" },
  { label: "Empleado", value: "EMPLOYEE" },
];

function SelectDemo({
  defaultValue = "",
  isDisabled = false,
  withDescription = false,
}: {
  defaultValue?: string;
  isDisabled?: boolean;
  withDescription?: boolean;
}) {
  const form = useForm({ defaultValues: { category: defaultValue } });
  return (
    <div className="max-w-sm">
      <form.Field name="category">
        {(field) => (
          <TanStackSelectField
            description={withDescription ? "Define el tipo de contraparte" : undefined}
            emptyOption={{ label: "Sin clasificar", value: "" }}
            field={field}
            isDisabled={isDisabled}
            label="Clasificación"
            options={SELECT_OPTIONS}
            placeholder="Selecciona una opción"
            required
          />
        )}
      </form.Field>
    </div>
  );
}

export const SelectDefault: Story = { render: () => <SelectDemo /> };

export const SelectWithValue: Story = {
  render: () => <SelectDemo defaultValue="CLIENT" withDescription />,
};

export const SelectDisabled: Story = {
  render: () => <SelectDemo defaultValue="SUPPLIER" isDisabled />,
};
