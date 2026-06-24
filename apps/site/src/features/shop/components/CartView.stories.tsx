import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { CartView } from "./CartView";

// Snapshotea el carrito en sus estados (con líneas / vacío / cargando) para que
// Chromatic detecte regresiones del listado de items, el resumen y el CTA de
// checkout. El carrito sale de los fixtures anclados al contrato (cart).
const meta: Meta<typeof CartView> = {
  title: "Shop/CartView",
  component: CartView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof CartView>;

export const WithItems: Story = {
  args: {
    cart: SHOP_FIXTURES.cart.data,
    isLoading: false,
  },
};

export const Empty: Story = {
  args: {
    cart: SHOP_FIXTURES.emptyCart.data,
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    cart: undefined,
    isLoading: true,
  },
};
