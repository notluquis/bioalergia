import type { Meta, StoryObj } from "@storybook/react-vite";

import { PRODUCT_FIXTURES } from "../../../../.storybook/msw-handlers";
import { sortProducts } from "../lib/catalog";
import { TiendaView } from "./TiendaView";

// Snapshotea la grilla de la tienda en sus estados clave (cargado / vacío /
// cargando / error) para que Chromatic detecte regresiones de layout del grid,
// el contador de productos y el selector de orden. La data sale de los fixtures
// anclados al contrato (catalog) en .storybook/msw-handlers.ts.
const meta: Meta<typeof TiendaView> = {
  title: "Shop/TiendaView",
  component: TiendaView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof TiendaView>;

const ALL = PRODUCT_FIXTURES.all;

export const Loaded: Story = {
  args: {
    products: sortProducts(ALL, "relevancia"),
    productCount: ALL.length,
    sort: "relevancia",
    isLoading: false,
    error: null,
  },
};

export const SortedByPriceDesc: Story = {
  args: {
    products: sortProducts(ALL, "precio_desc"),
    productCount: ALL.length,
    sort: "precio_desc",
    isLoading: false,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    products: [],
    productCount: 0,
    sort: "relevancia",
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    products: [],
    productCount: null,
    sort: "relevancia",
    isLoading: true,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    products: [],
    productCount: null,
    sort: "relevancia",
    isLoading: false,
    error: new Error("network"),
  },
};
