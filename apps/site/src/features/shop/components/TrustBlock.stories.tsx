import type { Meta, StoryObj } from "@storybook/react-vite";

import { TrustBlock } from "./TrustBlock";

// Bloque de confianza (envío, pago seguro, devoluciones) que aparece en la
// ficha de producto y el carrito. Presentacional puro; el flag `compact`
// cambia la densidad — snapshoteamos ambas variantes.
const meta: Meta<typeof TrustBlock> = {
  title: "Shop/TrustBlock",
  component: TrustBlock,
  parameters: {
    layout: "padded",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof TrustBlock>;

export const Default: Story = {};

export const Compact: Story = {
  args: { compact: true },
};
