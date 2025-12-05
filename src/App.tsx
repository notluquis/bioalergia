import React from "react";
import { Outlet, useNavigation } from "react-router-dom";
import { useDebounce } from "use-debounce";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import { BottomNav } from "./components/Layout/MobileNav";
import { APP_VERSION, BUILD_TIMESTAMP } from "./version";
import { useSettings } from "./context/SettingsContext";
import { UpdateNotification } from "./components/features/UpdateNotification";
import { PerformanceIndicator } from "./components/features/PerformanceIndicator";

export default function App() {
  const navigationState = useNavigation();
  const { settings } = useSettings();

  // Sidebar state: visible/hidden
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // Detect if mobile/tablet (md breakpoint)
  // We still need this for the overlay and initial state, but we can optimize it
  const [isMobile, setIsMobile] = React.useState(!window.matchMedia("(min-width: 768px)").matches);
  const [debouncedIsMobile] = useDebounce(isMobile, 150);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(!window.matchMedia("(min-width: 768px)").matches);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Use debounced value for sidebar control to prevent jank
  React.useEffect(() => {
    if (debouncedIsMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [debouncedIsMobile]);

  const toggleSidebar = () => setSidebarOpen((open) => !open);
  const closeSidebar = () => setSidebarOpen(false);

  // Desktop Sidebar Collapse State
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  const isNavigating = navigationState.state === "loading";
  const buildLabel = React.useMemo(() => {
    if (!BUILD_TIMESTAMP) return "Desconocido";
    const parsed = new Date(BUILD_TIMESTAMP);
    if (Number.isNaN(parsed.getTime())) return BUILD_TIMESTAMP;
    return parsed.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  }, []);

  React.useEffect(() => {
    if (settings?.pageTitle) {
      document.title = settings.pageTitle;
    }
  }, [settings?.pageTitle]);

  // Handle PWA File Launch (macOS/Windows "Open With")
  React.useEffect(() => {
    if ("launchQueue" in window) {
      interface LaunchParams {
        files: FileSystemFileHandle[];
      }
      interface LaunchQueue {
        setConsumer(callback: (launchParams: LaunchParams) => Promise<void>): void;
      }
      const launchQueue = (window as unknown as { launchQueue: LaunchQueue }).launchQueue;

      launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files.length) return;

        const fileHandle = launchParams.files[0];
        if (!fileHandle) return;
        const file = await fileHandle.getFile();
        void file; // Mark as used to avoid lint error until implemented

        // Store file in a global state or navigate with it
        // For now, we'll log it and maybe show a toast or redirect
        // console.log("File opened via OS:", file.name);

        // In a real implementation, we would upload this file or open the transaction modal
        // Since we can't easily pass the File object via URL params, we might need a context
        // For this prototype, we'll just acknowledge it
      });
    }
  }, []);

  // Windows 11 / macOS App Badging
  React.useEffect(() => {
    if (!("setAppBadge" in navigator)) return;

    // Example: Set badge if there are pending items (mocked for now)
    // In production, connect this to your notification/inbox context
    // navigator.setAppBadge(3);

    // Clear badge on focus
    const clearBadge = () => navigator.clearAppBadge();
    window.addEventListener("focus", clearBadge);
    return () => window.removeEventListener("focus", clearBadge);
  }, []);

  return (
    <>
      {isNavigating && (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden bg-base-200 shadow-lg">
          <div className="nav-progress__indicator" />
        </div>
      )}
      <div
        className="layout-shell relative mx-auto flex min-h-screen w-full gap-6 px-2 py-6 text-base-content transition-colors duration-300 sm:px-4 lg:px-6"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        {/* Hamburger button: accessible, compact, always visible on mobile */}
        <button
          type="button"
          className="fixed left-4 top-[clamp(0.9rem,env(safe-area-inset-top,0px)+0.9rem,2.5rem)] z-40 inline-flex items-center gap-2 rounded-full border border-base-300/70 bg-base-100/85 px-3 py-2 text-sm font-semibold text-base-content shadow-lg backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 md:hidden"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Cerrar menú principal" : "Abrir menú principal"}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          aria-pressed={sidebarOpen}
        >
          <span
            className={`relative flex h-5 w-5 flex-col items-center justify-center gap-[5px] rounded-full transition-colors ${
              sidebarOpen ? "text-primary" : "text-base-content"
            }`}
            aria-hidden="true"
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
          <span className="text-xs font-medium uppercase tracking-wide">{sidebarOpen ? "Cerrar" : "Menú"}</span>
        </button>

        {/* Overlay for mobile/tablet when sidebar is open */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-base-content/30 backdrop-blur-[1px] transition-opacity duration-300"
            role="presentation"
            aria-hidden="true"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isMobile={isMobile}
          onClose={closeSidebar}
          isCollapsed={isCollapsed}
          toggleCollapse={toggleCollapse}
        />

        {/* Main content */}
        <div className="layout-container flex min-w-0 flex-1 flex-col gap-6 pb-[calc(110px+env(safe-area-inset-bottom))] md:pb-0">
          <Header />

          <main className="flex-1 rounded-[2.25rem]">
            <div className="surface-recessed h-full rounded-[2.25rem] px-4 py-6 shadow-inner sm:px-6">
              <div className="muted-scrollbar h-full overflow-auto">
                <Outlet />
              </div>
            </div>
          </main>

          <footer className="surface-elevated hidden md:flex items-center justify-between px-6 py-3 text-sm text-base-content">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base-content">Bioalergia</span>
                <span className="text-xs text-base-content/60">v{APP_VERSION}</span>
              </div>

              {/* Performance Mode Indicator */}
              <PerformanceIndicator />
            </div>

            <div className="flex items-center gap-2 text-xs text-base-content/70">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" aria-hidden="true" />
              <span>Build: {buildLabel}</span>
            </div>
          </footer>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav />

        {/* Update notification popup */}
        <UpdateNotification />
      </div>
    </>
  );
}
