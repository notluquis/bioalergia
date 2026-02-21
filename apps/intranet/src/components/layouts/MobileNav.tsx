import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import React from "react";

import { Button } from "@/components/ui/Button";
import { useCan } from "@/hooks/use-can";
import { getNavSections, type NavItem } from "@/lib/nav-generator";

interface BottomNavProps {
  buildLabel?: string;
  isHidden?: boolean;
  isSessionActive?: boolean;
}

export function BottomNav({
  buildLabel,
  isHidden = false,
  isSessionActive = false,
}: Readonly<BottomNavProps>) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const { can } = useCan();
  const [pendingPath, setPendingPath] = React.useState<null | string>(null);

  React.useEffect(() => {
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

  const navItems = React.useMemo(() => {
    return getNavSections(router.routeTree)
      .flatMap((section) => section.items)
      .filter((item) => {
        return !(
          item.requiredPermission &&
          !can(item.requiredPermission.action, item.requiredPermission.subject)
        );
      })
      .slice(0, 4);
  }, [can, router.routeTree]);

  if (isHidden || navItems.length === 0) {
    return null;
  }

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-50 w-[min(100%-2rem,400px)] -translate-x-1/2 md:hidden">
      <div className="mb-2 flex items-center justify-between rounded-2xl border border-default-100 bg-background/80 px-3 py-1.5 text-[10px] shadow-lg backdrop-blur-xl">
        <span className="truncate text-default-500">Build: {buildLabel ?? "Desconocido"}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
            isSessionActive
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          <span
            className={`inline-flex h-1.5 w-1.5 rounded-full ${
              isSessionActive ? "bg-success" : "bg-danger"
            }`}
          />
          {isSessionActive ? "Sesión activa" : "Sin sesión"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1 rounded-4xl border border-default-100 bg-background/80 p-2 shadow-2xl backdrop-blur-xl">
        {navItems.map((item: NavItem) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Button
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-1 py-3 font-medium text-[10px] transition-all duration-300 ${
                active ? "text-primary" : "text-default-400 hover:text-default-700"
              }`}
              key={item.to}
              onPress={() => {
                setPendingPath(item.to);
                void navigate({ to: item.to as "/" });
              }}
              type="button"
              variant="ghost"
            >
              {/* Active Background Pill */}
              {active && (
                <div aria-hidden="true" className="absolute inset-0 rounded-3xl bg-primary/10" />
              )}

              <span className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  className={`h-6 w-6 transition-transform duration-300 ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`transition-opacity duration-300 ${active ? "font-semibold opacity-100" : "opacity-70"}`}
                >
                  {item.label}
                </span>
              </span>

              {/* Notification Dot (Pending) */}
              {pendingPath === item.to && !active && (
                <span className="absolute top-2 right-1/4 h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50" />
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
