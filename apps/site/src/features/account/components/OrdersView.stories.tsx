import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { OrdersView } from "./OrdersView";

// Snapshotea la lista de pedidos de /mi-cuenta en sus estados (con pedidos /
// vacío / cargando) para que Chromatic detecte regresiones de las cards de
// pedido, el monto y el estado. Los pedidos salen de los fixtures anclados al
// contrato (account.myOrders).
const meta: Meta<typeof OrdersView> = {
  title: "Account/OrdersView",
  component: OrdersView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof OrdersView>;

export const WithOrders: Story = {
  args: {
    orders: SHOP_FIXTURES.accountOrders.data,
    isLoading: false,
  },
};

export const Empty: Story = {
  args: {
    orders: [],
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    orders: undefined,
    isLoading: true,
  },
};
