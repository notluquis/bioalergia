import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { AccountLayoutView } from "./AccountLayoutView";

// Snapshotea el shell de /mi-cuenta (card de usuario + nav lateral + sección
// ruteada) para que Chromatic detecte regresiones del sidebar, el resaltado del
// link activo y el botón de cerrar sesión. El usuario sale del fixture anclado
// al contrato (site-auth.me).
const meta: Meta<typeof AccountLayoutView> = {
  title: "Account/AccountLayoutView",
  component: AccountLayoutView,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof AccountLayoutView>;

const USER = {
  name: SHOP_FIXTURES.accountMe.data.name,
  email: SHOP_FIXTURES.accountMe.data.email,
};

const PLACEHOLDER = (
  <div className="rounded border border-default-200 border-dashed p-6 text-default-500 text-sm">
    Contenido de la sección (Outlet)
  </div>
);

export const OverviewActive: Story = {
  args: {
    user: USER,
    activePath: "/mi-cuenta",
    isLoggingOut: false,
    onLogout: () => undefined,
    children: PLACEHOLDER,
  },
};

export const OrdersActive: Story = {
  args: {
    user: USER,
    activePath: "/mi-cuenta/pedidos",
    isLoggingOut: false,
    onLogout: () => undefined,
    children: PLACEHOLDER,
  },
};

export const LoggingOut: Story = {
  args: {
    user: { name: null, email: "demo@bioalergia.cl" },
    activePath: "/mi-cuenta",
    isLoggingOut: true,
    onLogout: () => undefined,
    children: PLACEHOLDER,
  },
};
