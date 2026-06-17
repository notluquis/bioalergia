import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { AccountOverviewView } from "./AccountOverviewView";

// Snapshotea el dashboard de /mi-cuenta (saludo + últimos pedidos) en sus
// estados (con pedidos / vacío / cargando) para que Chromatic detecte
// regresiones del encabezado y la card de pedidos recientes. Los datos salen de
// los fixtures anclados al contrato (account.myOrders + site-auth.me).
const meta: Meta<typeof AccountOverviewView> = {
  title: "Account/AccountOverviewView",
  component: AccountOverviewView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof AccountOverviewView>;

export const WithOrders: Story = {
  args: {
    name: SHOP_FIXTURES.accountMe.data.name,
    recentOrders: SHOP_FIXTURES.accountOrders.data,
    isLoading: false,
  },
};

export const Empty: Story = {
  args: {
    name: "Hola",
    recentOrders: [],
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    name: "Hola",
    recentOrders: undefined,
    isLoading: true,
  },
};
