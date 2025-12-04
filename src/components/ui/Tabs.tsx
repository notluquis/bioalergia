import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Clear pending state when location changes (navigation completed)
  useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

  return (
    <nav className={cn("flex items-center gap-3 overflow-x-auto pb-1", className)}>
      {items.map((item) => {
        // Check if this tab is the pending destination
        const isThisPending = pendingPath === item.to;
        // Check if already on this page
        const isCurrentPath = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => {
              // Only set pending if we're navigating to a different page
              if (!isCurrentPath) {
                setPendingPath(item.to);
              }
            }}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                isActive || isThisPending
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {item.label}
            {isThisPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </NavLink>
        );
      })}
    </nav>
  );
}
