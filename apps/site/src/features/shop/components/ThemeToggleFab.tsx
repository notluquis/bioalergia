import { Button } from "@heroui/react";
import { useMatchRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggleFab() {
  const matchRoute = useMatchRoute();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onShop = Boolean(
    matchRoute({ to: "/tienda", fuzzy: true }) ||
    matchRoute({ to: "/producto/$slug" }) ||
    matchRoute({ to: "/carrito" }) ||
    matchRoute({ to: "/checkout" })
  );
  if (!onShop || !mounted) return null;
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="fixed top-4 left-4 z-50 rounded-full shadow-md sm:top-6 sm:left-6 sm:h-12 sm:w-12 size-10"
      isIconOnly
      onPress={() => setTheme(isDark ? "light" : "dark")}
      variant="secondary"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
