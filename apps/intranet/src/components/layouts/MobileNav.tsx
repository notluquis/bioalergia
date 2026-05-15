import { Button } from "@heroui/react";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCan } from "@/hooks/use-can";
import { getNavSections, type NavItem } from "@/lib/nav-generator";
import { DeploymentStatusChip } from "./DeploymentStatusChip";

interface BottomNavProps {
  buildLabel?: string;
  isHidden?: boolean;
}

export function BottomNav({ buildLabel, isHidden = false }: Readonly<BottomNavProps>) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const { can } = useCan();
  const [pendingPath, setPendingPath] = useState<null | string>(null);

  useEffect(() => {
    if (pendingPath && pendingPath === pathname) {
      setPendingPath(null);
    }
  }, [pathname, pendingPath]);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const navItems = useMemo(() => {
    const preferredOrder = ["/marcar"];

    return getNavSections(router.routeTree)
      .flatMap((section) => section.items)
      .filter((item) => {
        return !(
          item.requiredPermission &&
          !can(item.requiredPermission.action, item.requiredPermission.subject)
        );
      })
      .sort((a, b) => {
        const aPriority = preferredOrder.indexOf(a.to);
        const bPriority = preferredOrder.indexOf(b.to);
        const normalizedAPriority = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
        const normalizedBPriority = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;
        if (normalizedAPriority !== normalizedBPriority) {
          return normalizedAPriority - normalizedBPriority;
        }
        return 0;
      })
      .slice(0, 4);
  }, [can, router.routeTree]);

  if (isHidden || navItems.length === 0) {
    return null;
  }

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-50 w-[min(100%-2rem,400px)] -translate-x-1/2 md:hidden">
      <div className="mb-2 flex items-center justify-between rounded-2xl border border-default-100 bg-background/80 px-3 py-1.5 text-xs shadow-lg backdrop-blur-xl">
        <span className="truncate text-default-600">
          {buildLabel ? `Build: ${buildLabel}` : ""}
        </span>
        <DeploymentStatusChip compact />
      </div>
      <div className="flex items-center justify-between gap-1 rounded-4xl border border-default-100 bg-background/80 p-2 shadow-2xl backdrop-blur-xl">
        {navItems.map((item: NavItem) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Button
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-1 py-3 font-medium text-xs ${
                active ? "text-primary" : "text-default-600 hover:text-default-800"
              }`}
              key={item.to}
              onPress={() => {
                setPendingPath(item.to);
                void navigate({ to: item.to as "/" });
              }}
              type="button"
              variant="outline"
            >
              {/* Active Background Pill */}
              {active && (
                <div aria-hidden="true" className="absolute inset-0 rounded-3xl bg-primary/10" />
              )}

              <span className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  className={`size-6 ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={
                    active ? "font-semibold text-foreground" : "text-default-600"
                  }
                >
                  {item.label}
                </span>
              </span>

              {/* Notification Dot (Pending) */}
              {pendingPath === item.to && !active && (
                <span className="absolute top-2 right-1/4 rounded-full bg-primary shadow-lg shadow-primary/50 size-2" />
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
