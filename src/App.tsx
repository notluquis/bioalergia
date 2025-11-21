import React from "react";
import { Outlet, useNavigation } from "react-router-dom";
import { useDebounce } from "use-debounce";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import { BottomNav } from "./components/Layout/MobileNav";
import Clock from "./components/features/Clock";

export default function App() {
  const navigationState = useNavigation();

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

  const isNavigating = navigationState.state === "loading";

  return (
    <>
      {isNavigating && (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden bg-base-200 shadow-lg">
          <div className="nav-progress__indicator" />
        </div>
      )}
      <div className="layout-shell relative mx-auto flex min-h-screen w-full gap-6 px-2 py-6 text-base-content transition-colors duration-300 sm:px-4 lg:px-6">
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
            className={`relative flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              sidebarOpen ? "bg-primary/10 text-primary" : "bg-base-200 text-base-content"
            }`}
            aria-hidden="true"
          >
            <span
              className={`block h-[1.5px] w-3 rounded-full transition-all duration-200 ${
                sidebarOpen ? "translate-y-[3px] rotate-45 bg-primary" : "-translate-y-1 bg-base-content"
              }`}
            />
            <span
              className={`block h-[1.5px] w-3 rounded-full transition-all duration-200 ${
                sidebarOpen ? "-translate-y-[3px] -rotate-45 bg-primary" : "translate-y-1 bg-base-content"
              }`}
            />
          </span>
          <span className="text-xs uppercase tracking-wide">{sidebarOpen ? "Cerrar" : "Menú"}</span>
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
        <Sidebar isOpen={sidebarOpen} isMobile={isMobile} onClose={closeSidebar} />

        {/* Main content */}
        <div className="layout-container flex min-w-0 flex-1 flex-col gap-6 pb-[110px] md:pb-0">
          <Header />

          <main className="flex-1 rounded-[2.25rem]">
            <div className="surface-recessed h-full rounded-[2.25rem] px-4 py-6 shadow-inner sm:px-6">
              <div className="muted-scrollbar h-full overflow-auto">
                <Outlet />
              </div>
            </div>
          </main>

          <footer className="surface-elevated hidden md:flex items-center justify-between px-6 py-3 text-sm text-base-content">
            <span className="font-medium text-base-content/70">Bioalergia Finanzas</span>
            <Clock />
          </footer>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav />
      </div>
    </>
  );
}
