import type { Meta, StoryObj } from "@storybook/react-vite";

import { PRODUCT_FIXTURES, SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { ProductDetailView } from "./ProductDetailView";

// Snapshotea la ficha de producto en sus estados (en stock / oferta / agotado /
// recién agregado) para que Chromatic detecte regresiones del chip de stock, el
// precio tachado, el selector de cantidad y la barra sticky móvil. El producto
// y las reseñas salen de los fixtures anclados al contrato (catalog).
const meta: Meta<typeof ProductDetailView> = {
  title: "Shop/ProductDetailView",
  component: ProductDetailView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
  args: {
    lowStockThreshold: 3,
    reviewsAggregate: SHOP_FIXTURES.reviews.aggregate,
    qty: 1,
    isAdding: false,
    added: false,
    feedback: null,
  },
};

export default meta;

type Story = StoryObj<typeof ProductDetailView>;

export const InStock: Story = {
  args: { product: PRODUCT_FIXTURES.inStock },
};

export const OnSale: Story = {
  args: { product: PRODUCT_FIXTURES.onSale },
};

export const OutOfStock: Story = {
  args: { product: PRODUCT_FIXTURES.outOfStock },
};

export const Added: Story = {
  args: { product: PRODUCT_FIXTURES.inStock, added: true },
};

export const Error: Story = {
  args: { product: PRODUCT_FIXTURES.inStock, feedback: "No se pudo agregar al carrito." },
};
