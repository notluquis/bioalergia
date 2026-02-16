import { Tooltip } from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { Outlet, useRouterState } from "@tanstack/react-router";
import React from "react";

import { UpdateNotification } from "./components/features/UpdateNotification";
import { Header } from "./components/layouts/Header";
import { BottomNav } from "./components/layouts/MobileNav";
import { Sidebar } from "./components/layouts/Sidebar";
import { Button } from "./components/ui/Button";
import { useAuth } from "./context/AuthContext";
import { useSettings } from "./context/SettingsContext";
import { BUILD_TIMESTAMP } from "./version";
export function App() {
  const { impersonatedRole, stopImpersonating, user } = useAuth();
  const navigationState = useRouterState({ select: (s) => s.status });
  const { settings } = useSettings();

  // Sidebar state: visible/hidden
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // Detect if mobile/tablet (md breakpoint)
  // Optimized 2025: Use standard matchMedia listener instead of resize event to avoid layout thrashing
  const [isMobile, setIsMobile] = React.useState(
    !globalThis.matchMedia("(min-width: 768px)").matches,
  );
  const [debouncedIsMobile] = useDebouncedValue(isMobile, { wait: 150 });

  React.useEffect(() => {
    const mql = globalThis.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
    };

    // Set initial value
    setIsMobile(!mql.matches);

    // Modern event listener for Media Query
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  // Use debounced value for sidebar control to prevent jank
  React.useEffect(() => {
    if (debouncedIsMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [debouncedIsMobile]);

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
  };
  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Desktop Sidebar Collapse State logic removed (handled internally by Sidebar hover)

  const isNavigating = navigationState === "pending";
  const buildLabel = React.useMemo(() => {
    if (!BUILD_TIMESTAMP) {
      return "Desconocido";
    }
    const parsed = new Date(BUILD_TIMESTAMP);
    if (Number.isNaN(parsed.getTime())) {
      return BUILD_TIMESTAMP;
    }
    return parsed.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  }, []);

  React.useEffect(() => {
    if (settings.pageTitle) {
      document.title = settings.pageTitle;
    }
  }, [settings.pageTitle]);

  // Handle PWA File Launch (macOS/Windows "Open With")
  React.useEffect(() => {
    if ("launchQueue" in globalThis) {
      interface LaunchParams {
        files: FileSystemFileHandle[];
      }
      interface LaunchQueue {
        setConsumer(callback: (launchParams: LaunchParams) => Promise<void>): void;
      }
      const launchQueue = (globalThis as unknown as { launchQueue: LaunchQueue }).launchQueue;

      launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files.length === 0) {
          return;
        }

        const fileHandle = launchParams.files[0];
        if (!fileHandle) {
          return;
        }

        // In a real implementation, we would handle the file from the PWA launch
        // For now, we just acknowledge it
      });
    }
  }, []);

  return (
    <>
      {impersonatedRole && (
        <div className="sticky top-0 z-100 flex h-10 w-full items-center justify-center gap-4 bg-warning px-4 font-bold text-warning-foreground text-xs shadow-md">
          <span>VISTA PREVIA: {impersonatedRole.name}</span>
          <Button
            size="sm"
            className="border-none bg-black/20 text-current hover:bg-black/30"
            onClick={stopImpersonating}
            variant="ghost"
          >
            Salir
          </Button>
        </div>
      )}
      {isNavigating && (
        <div className="fixed top-0 right-0 left-0 z-50 h-1 overflow-hidden bg-default-50 shadow-lg">
          <div className="nav-progress__indicator" />
        </div>
      )}
      {/* Layout Shell: Main Flex Container - Height constrained to dynamic viewport */}
      <div className="layout-shell relative mx-auto flex h-dvh w-full gap-0 overflow-hidden p-0 text-foreground transition-all duration-300 md:gap-4 md:p-4">
        {/* Hamburger button: accessible, compact, always visible on mobile */}
        <Button
          aria-controls="app-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Cerrar menú principal" : "Abrir menú principal"}
          aria-pressed={sidebarOpen}
          className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] left-4 z-40 inline-flex items-center gap-2 rounded-full border border-default-200/70 bg-background/85 px-3 py-2 font-semibold text-foreground text-sm shadow-lg backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 md:hidden"
          onPress={toggleSidebar}
          type="button"
          variant="ghost"
        >
          <span
            aria-hidden="true"
            className={`relative flex h-5 w-5 flex-col items-center justify-center gap-1.25 rounded-full transition-colors ${
              sidebarOpen ? "text-primary" : "text-foreground"
            }`}
          >
            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${
                sidebarOpen ? "absolute translate-y-0 rotate-45" : ""
              }`}
            />

            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${
                sidebarOpen ? "absolute translate-y-0 -rotate-45" : ""
              }`}
            />
          </span>
          <span className="font-medium text-xs uppercase tracking-wide">
            {sidebarOpen ? "Cerrar" : "Menú"}
          </span>
        </Button>

        {/* Sidebar */}
        <Sidebar isMobile={isMobile} isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main content */}
        <div className="layout-container flex min-w-0 flex-1 flex-col gap-3 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-[calc(110px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
          <Header />

          <main className="flex-1 overflow-hidden rounded-3xl transition-all duration-300">
            <div className="surface-recessed h-full w-full overflow-hidden rounded-3xl border border-default-100/50 bg-background/50 shadow-inner">
              <div className="muted-scrollbar h-full w-full overflow-y-auto overflow-x-hidden p-3 md:p-5">
                <Outlet />
              </div>
            </div>
          </main>

          <footer className="surface-elevated hidden px-6 py-3 text-foreground text-sm md:flex">
            <div className="grid w-full grid-cols-3 items-center gap-2 text-xs">
              <span className="text-default-500">Build: {buildLabel}</span>
              <div className="flex justify-center">
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      aria-label="Créditos"
                      className="min-w-0 px-2 text-danger"
                      size="sm"
                      variant="ghost"
                    >
                      ♥
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    className="select-none whitespace-nowrap break-normal [overflow-wrap:normal]"
                    placement="top"
                    showArrow
                  >
                    Hecho con ♥ por Lucas Pulgar Escobar para Bioalergia
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <div className="flex justify-end">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${
                    user
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      user ? "bg-success" : "bg-danger"
                    }`}
                  />
                  {user ? "Sesión activa" : "Sin sesión"}
                </span>
              </div>
            </div>
          </footer>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav isHidden={isMobile && sidebarOpen} />

        {/* Update notification popup */}
        <UpdateNotification />
      </div>
    </>
  );
}
