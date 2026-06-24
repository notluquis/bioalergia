import type { Meta, StoryObj } from "@storybook/react-vite";

import { RelatedProducts } from "./RelatedProducts";

// "También te puede interesar": grid de ProductCards alimentado por
// catalog.list filtrado por categoría. Excluye el producto actual (excludeId).
// Los datos vienen del handler MSW global (5 productos) → con exclude=1 quedan
// 4 cards, suficiente para snapshotear el grid responsive.
const meta: Meta<typeof RelatedProducts> = {
  title: "Shop/RelatedProducts",
  component: RelatedProducts,
  parameters: {
    layout: "padded",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof RelatedProducts>;

export const Default: Story = {
  args: { categorySlug: "respiratorio", excludeId: 1 },
};
