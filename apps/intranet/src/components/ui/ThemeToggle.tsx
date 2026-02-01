import { Moon, Sun } from "lucide-react";
import Button from "@/components/ui/Button";
import { useTheme } from "@/hooks/use-theme";

export default function ThemeToggle() {
  const { toggleTheme, isDark, resolvedTheme } = useTheme();

  const icon = isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;

  const label = resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <Button
      aria-label={label}
      isIconOnly
      variant="ghost"
      className={`rounded-full border-default-200/70 bg-background/80 text-foreground border shadow-sm transition-all duration-300 ${
        isDark
          ? "hover:bg-default-50/40 hover:border-primary/60"
          : "hover:bg-default-50/70 hover:border-primary/60"
      }`}
      onPress={toggleTheme}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
          isDark
            ? "from-base-200 via-primary/40 to-primary text-primary-foreground shadow-primary/20 bg-linear-to-br shadow-inner"
            : "from-base-100 via-primary/10 to-primary/70 text-primary shadow-primary/10 bg-linear-to-br shadow-inner"
        }`}
      >
        {icon}
      </span>
    </Button>
  );
}
