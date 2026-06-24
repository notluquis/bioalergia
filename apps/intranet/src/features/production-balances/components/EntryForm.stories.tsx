import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { DailyBalanceFormData } from "../types";
import { EntryForm } from "./EntryForm";

// Guardia visual del bug "input de 40px": NumberField.Group sin steppers usa
// el grid base 40px/1fr/40px y deja el input en la columna de 40px (número
// cortado). EntryForm lo corrige con grid-cols-[1fr] + fullWidth — si alguien
// lo revierte, el snapshot de Chromatic muestra los montos truncados.

const emptyValues: DailyBalanceFormData = {
  consultas: 0,
  controles: 0,
  efectivo: 0,
  gastos: 0,
  licencias: 0,
  nota: "",
  otros: 0,
  roxair: 0,
  tarjeta: 0,
  tests: 0,
  transferencia: 0,
  vacunas: 0,
};

const filledValues: DailyBalanceFormData = {
  consultas: 1_250_000,
  controles: 340_000,
  efectivo: 485_000,
  gastos: 75_000,
  licencias: 120_000,
  nota: "Cierre normal, sin novedades.",
  otros: 15_000,
  roxair: 90_000,
  tarjeta: 1_890_000,
  tests: 560_000,
  transferencia: 705_000,
  vacunas: 230_000,
};

const meta: Meta<typeof EntryForm> = {
  title: "ProductionBalances/EntryForm",
  component: EntryForm,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Formulario de ingreso del balance diario: métodos de pago, gastos y desglose por servicio. Montos CLP vía NumberField (anatomía Group/Input de una columna, fullWidth).",
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider locale="es-CL">
        <div className="mx-auto max-w-3xl p-8">
          <Story />
        </div>
      </I18nProvider>
    ),
  ],
  args: {
    onChange: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof EntryForm>;

/** Día sin datos: todos los montos en $0 deben verse completos, no cortados. */
export const Empty: Story = {
  args: { values: emptyValues },
};

/** Montos millonarios CLP: ancho completo del input, sin truncar dígitos. */
export const Filled: Story = {
  args: { values: filledValues },
};

/** Día finalizado: todos los campos deshabilitados. */
export const Finalized: Story = {
  args: { disabled: true, values: filledValues },
};
