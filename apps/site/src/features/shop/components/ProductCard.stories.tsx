import type { Meta, StoryObj } from "@storybook/react-vite";

import { PRODUCT_FIXTURES } from "../../../../.storybook/msw-handlers";
import { ProductCard } from "./ProductCard";

// Snapshotea la card de producto del storefront en sus estados clave para que
// Chromatic detecte regresiones del chip de stock, el precio tachado (oferta)
// y la insignia de receta médica. Antes la tienda no tenía stories → CI ciego.
//
// El `product` se toma de los fixtures anclados al contrato (catalog) en
// .storybook/msw-handlers.ts, así que la forma nunca diverge del schema real.
const meta: Meta<typeof ProductCard> = {
  title: "Shop/ProductCard",
  component: ProductCard,
  parameters: {
    layout: "centered",
    chromatic: { viewports: [1280, 390] },
  },
  // La card vive en un grid de ~280px; la encuadramos para snapshots estables.
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProductCard>;

export const InStock: Story = {
  args: { product: PRODUCT_FIXTURES.inStock },
};

export const LowStock: Story = {
  args: { product: PRODUCT_FIXTURES.lowStock },
};

export const OutOfStock: Story = {
  args: { product: PRODUCT_FIXTURES.outOfStock },
};

export const OnSale: Story = {
  args: { product: PRODUCT_FIXTURES.onSale },
};

export const RequiresPrescription: Story = {
  args: { product: PRODUCT_FIXTURES.rx },
};
