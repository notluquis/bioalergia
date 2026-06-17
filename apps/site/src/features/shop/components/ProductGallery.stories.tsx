import type { Meta, StoryObj } from "@storybook/react-vite";

import { PRODUCT_FIXTURES } from "../../../../.storybook/msw-handlers";
import { ProductGallery } from "./ProductGallery";

// Galería de la ficha de producto (carrusel Embla + thumbnails). Presentacional:
// recibe las imágenes por prop. Usamos las imágenes del fixture in-stock más una
// variante multi-imagen para snapshotear los thumbnails/controles.
const meta: Meta<typeof ProductGallery> = {
  title: "Shop/ProductGallery",
  component: ProductGallery,
  parameters: {
    layout: "padded",
    chromatic: { viewports: [1280, 390] },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProductGallery>;

export const SingleImage: Story = {
  args: {
    productName: PRODUCT_FIXTURES.inStock.name,
    images: PRODUCT_FIXTURES.inStock.images,
  },
};

export const MultipleImages: Story = {
  args: {
    productName: "Kit Control de Ácaros",
    images: [
      { cdn_url: "https://picsum.photos/seed/g1/600/600", alt: "Vista 1", is_primary: true },
      { cdn_url: "https://picsum.photos/seed/g2/600/600", alt: "Vista 2", is_primary: false },
      { cdn_url: "https://picsum.photos/seed/g3/600/600", alt: "Vista 3", is_primary: false },
    ],
  },
};
