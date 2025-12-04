import { NavLink, useLocation, useNavigation } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface TabItem {
  label: string;
  to: string;
  end?: boolean;
}

interface TabsProps {
  items: TabItem[];
  className?: string;
}

export function Tabs({ items, className }: TabsProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Clear pending state when navigation completes
  if (navigation.state === "idle" && pendingPath) {
    setPendingPath(null);
  }

  return (
    <nav className={cn("flex items-center gap-3 overflow-x-auto pb-1", className)}>
      {items.map((item) => {
        const isPending = pendingPath === item.to && navigation.state === "loading";
        const alreadyHere = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => {
              if (!alreadyHere) setPendingPath(item.to);
            }}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                isActive || isPending
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {item.label}
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </NavLink>
        );
      })}
    </nav>
  );
}
