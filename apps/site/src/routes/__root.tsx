import { createRootRoute, Outlet } from "@tanstack/react-router";

import { CartBadge } from "@/features/shop/components/CartBadge";
import { WhatsAppFab } from "@/features/shop/components/WhatsAppFab";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <CartBadge />
      <WhatsAppFab />
    </>
  ),
});
