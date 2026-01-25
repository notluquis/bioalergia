import { useDebouncedValue } from "@tanstack/react-pacer";
import { Outlet, useRouterState } from "@tanstack/react-router";
import React from "react";

import { PerformanceIndicator } from "./components/features/PerformanceIndicator";
import { UpdateNotification } from "./components/features/UpdateNotification";
import Header from "./components/layouts/Header";
import { BottomNav } from "./components/layouts/MobileNav";
import Sidebar from "./components/layouts/Sidebar";
import Button from "./components/ui/Button";
import { Tooltip } from "./components/ui/Tooltip";
import { useAuth } from "./context/AuthContext";
import { useSettings } from "./context/SettingsContext";
import { BUILD_TIMESTAMP } from "./version";

export default function App() {
  const { impersonatedRole, stopImpersonating } = useAuth();
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
    if (!BUILD_TIMESTAMP) return "Desconocido";
    const parsed = new Date(BUILD_TIMESTAMP);
    if (Number.isNaN(parsed.getTime())) return BUILD_TIMESTAMP;
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
        if (launchParams.files.length === 0) return;

        const fileHandle = launchParams.files[0];
        if (!fileHandle) return;
        const file = await fileHandle.getFile();
        console.debug("File opened via PWA launch:", file);

        // Store file in a global state or navigate with it
        // For now, we'll log it and maybe show a toast or redirect

        // In a real implementation, we would upload this file or open the transaction modal
        // Since we can't easily pass the File object via URL params, we might need a context
        // For this prototype, we'll just acknowledge it
      });
    }
  }, []);

  return (
    <>
      {impersonatedRole && (
        <div className="bg-warning text-warning-foreground sticky top-0 z-100 flex h-10 w-full items-center justify-center gap-4 px-4 text-xs font-bold shadow-md">
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
        <div className="bg-default-50 fixed top-0 right-0 left-0 z-50 h-1 overflow-hidden shadow-lg">
          <div className="nav-progress__indicator" />
        </div>
      )}
      {/* Layout Shell: Main Flex Container - Height constrained to dynamic viewport */}
      <div className="layout-shell text-foreground relative mx-auto flex h-dvh w-full gap-0 overflow-hidden p-0 transition-all duration-300 md:gap-4 md:p-4">
        {/* Hamburger button: accessible, compact, always visible on mobile */}
        <button
          aria-controls="app-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Cerrar menú principal" : "Abrir menú principal"}
          aria-pressed={sidebarOpen}
          className="border-default-200/70 bg-background/85 text-foreground focus-visible:ring-primary/60 fixed top-[calc(env(safe-area-inset-top)+0.5rem)] left-4 z-40 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-lg backdrop-blur-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none md:hidden"
          onClick={toggleSidebar}
          type="button"
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
          <span className="text-xs font-medium tracking-wide uppercase">
            {sidebarOpen ? "Cerrar" : "Menú"}
          </span>
        </button>

        {/* Sidebar */}
        <Sidebar isMobile={isMobile} isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main content */}
        <div className="layout-container flex min-w-0 flex-1 flex-col gap-3 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-[calc(110px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
          <Header />

          <main className="flex-1 overflow-hidden rounded-3xl transition-all duration-300">
            <div className="surface-recessed border-default-100/50 bg-background/50 h-full w-full overflow-hidden rounded-3xl border shadow-inner">
              <div className="muted-scrollbar h-full w-full overflow-x-hidden overflow-y-auto p-3 md:p-5">
                <Outlet />
              </div>
            </div>
          </main>

          <footer className="surface-elevated text-foreground hidden items-center justify-between px-6 py-3 text-sm md:flex">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-default-500">Build: {buildLabel}</span>
              <span className="text-default-400">
                Hecho con ♥ por Lucas Pulgar Escobar para Bioalergia
              </span>
            </div>

            <div className="flex items-center gap-3">
              <PerformanceIndicator />
              <Tooltip content="Sistema operativo">
                <div className="text-default-600 flex cursor-help items-center gap-2 text-xs">
                  {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: legacy tooltip */}
                  <span
                    aria-label="Sistema operativo"
                    className="bg-success/70 inline-flex h-2 w-2 rounded-full"
                  />
                </div>
              </Tooltip>
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
