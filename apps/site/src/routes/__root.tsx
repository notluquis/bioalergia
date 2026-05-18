import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

import { CartBadge } from "@/features/shop/components/CartBadge";
import { ThemeToggleFab } from "@/features/shop/components/ThemeToggleFab";
import { WhatsAppFab } from "@/features/shop/components/WhatsAppFab";

export const Route = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <CartBadge />
      <ThemeToggleFab />
      <WhatsAppFab />
    </>
  ),
});
