import { createRootRoute, Outlet } from "@tanstack/react-router";

import { CartBadge } from "@/features/shop/components/CartBadge";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <CartBadge />
    </>
  ),
});
