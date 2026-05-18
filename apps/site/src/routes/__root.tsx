import { createRootRoute, Outlet } from "@tanstack/react-router";

import { CartBadge } from "@/features/shop/components/CartBadge";
import { ThemeToggleFab } from "@/features/shop/components/ThemeToggleFab";
import { WhatsAppFab } from "@/features/shop/components/WhatsAppFab";
import { useThemePreference } from "@/lib/theme";

function RootLayout() {
  useThemePreference();
  return (
    <>
      <Outlet />
      <CartBadge />
      <ThemeToggleFab />
      <WhatsAppFab />
    </>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
