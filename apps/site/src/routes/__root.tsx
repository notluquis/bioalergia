import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

import { CartBadge } from "@/features/shop/components/CartBadge";
import { CookiesBanner } from "@/features/shop/components/CookiesBanner";
import { WhatsAppFab } from "@/features/shop/components/WhatsAppFab";

export const Route = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <CartBadge />
      <WhatsAppFab />
      <CookiesBanner />
    </>
  ),
});
