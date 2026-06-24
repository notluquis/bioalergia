import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusTicks } from "./_shared";

const meta: Meta<typeof StatusTicks> = {
  title: "WaCloud/Shared/StatusTicks",
  component: StatusTicks,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Indicador visual del estado de un mensaje de WhatsApp Cloud (PENDING, SENT, DELIVERED, READ, FAILED). Cada estado expone su `aria-label` en español para lectores de pantalla y usa color semántico (`text-accent` para leído, `text-danger` para fallido).",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof StatusTicks>;

export const Pending: Story = { args: { status: "PENDING" } };
export const Sent: Story = { args: { status: "SENT" } };
export const Delivered: Story = { args: { status: "DELIVERED" } };
export const Read: Story = { args: { status: "READ" } };
export const Failed: Story = { args: { status: "FAILED" } };

export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-1 text-default-700 text-sm">
        <StatusTicks status="PENDING" /> enviando
      </span>
      <span className="flex items-center gap-1 text-default-700 text-sm">
        <StatusTicks status="SENT" /> enviado
      </span>
      <span className="flex items-center gap-1 text-default-700 text-sm">
        <StatusTicks status="DELIVERED" /> entregado
      </span>
      <span className="flex items-center gap-1 text-default-700 text-sm">
        <StatusTicks status="READ" /> leído
      </span>
      <span className="flex items-center gap-1 text-default-700 text-sm">
        <StatusTicks status="FAILED" /> falló
      </span>
    </div>
  ),
};
