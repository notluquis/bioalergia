import { Button } from "@heroui/react";
import { useMatchRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";

import { useThemePreference } from "@/lib/theme";

export function ThemeToggleFab() {
  const matchRoute = useMatchRoute();
  const { theme, toggle } = useThemePreference();
  const onShop = Boolean(
    matchRoute({ to: "/tienda", fuzzy: true }) ||
      matchRoute({ to: "/producto/$slug" }) ||
      matchRoute({ to: "/carrito" }) ||
      matchRoute({ to: "/checkout" })
  );
  if (!onShop) return null;

  return (
    <Button
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="fixed top-4 left-4 z-50 h-10 w-10 rounded-full shadow-md sm:top-6 sm:left-6 sm:h-12 sm:w-12"
      isIconOnly
      onPress={toggle}
      variant="secondary"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
