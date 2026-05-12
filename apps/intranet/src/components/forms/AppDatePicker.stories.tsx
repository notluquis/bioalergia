import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { AppDatePicker, AppDateTimePicker } from "./AppDatePicker";

const meta: Meta<typeof AppDatePicker> = {
  title: "Forms/AppDatePicker",
  component: AppDatePicker,
  parameters: {
    docs: {
      description: {
        component:
          'Replaces native `<input type="date">` (which fails axe + has inconsistent UX across iOS/Android/desktop). Wraps HeroUI v3 DatePicker. Value is `YYYY-MM-DD` so existing useState shapes don\'t change.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AppDatePicker>;

function DateDemo({ defaultValue = "2026-05-12" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="max-w-sm space-y-2 p-4">
      <AppDatePicker
        label="Fecha de nacimiento"
        description="Formato ISO YYYY-MM-DD"
        value={value}
        onChange={setValue}
      />
      <p className="text-default-500 text-xs">Valor: {value || "(vacío)"}</p>
    </div>
  );
}

export const Default: Story = { render: () => <DateDemo /> };

export const Empty: Story = { render: () => <DateDemo defaultValue="" /> };

export const WithError: Story = {
  render: () => (
    <div className="max-w-sm p-4">
      <AppDatePicker
        label="Fecha"
        errorMessage="Fecha requerida"
        isInvalid
        value=""
        onChange={() => {}}
      />
    </div>
  ),
};

export const DateTimeVariant: Story = {
  render: () => {
    const [value, setValue] = useState("2026-05-12T15:30");
    return (
      <div className="max-w-sm space-y-2 p-4">
        <AppDateTimePicker label="Fecha y hora de cita" value={value} onChange={setValue} />
        <p className="text-default-500 text-xs">Valor: {value}</p>
      </div>
    );
  },
};
