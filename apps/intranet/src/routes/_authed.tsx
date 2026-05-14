import { Button, Link, Tooltip } from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { createFileRoute, getRouteApi, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UpdateNotification } from "@/components/features/UpdateNotification";
import { Header } from "@/components/layouts/Header";
import { BottomNav } from "@/components/layouts/MobileNav";
import { DeploymentStatusChip } from "@/components/layouts/DeploymentStatusChip";
import { RouteHeading } from "@/components/layouts/RouteHeading";
import { Sidebar } from "@/components/layouts/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import type { AuthSessionData } from "@/features/auth/types";
import { ability, updateAbility } from "@/lib/authz/ability";
import { BUILD_TIMESTAMP } from "@/version";

// This layout wraps all authenticated routes.
// The `beforeLoad` check ensures the user is logged in before rendering any child routes.

const routeApi = getRouteApi("/_authed");

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    // Wait for session to load before making auth decision
    const user = await context.auth.ensureSession();

    // If not authenticated, redirect to login with return URL
    if (!user) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({
        search: {
          redirect: location.href,
        },
        to: "/login",
      });
    }

    // Force onboarding if status is pending
    if (user.status === "PENDING_SETUP" && !location.pathname.startsWith("/onboarding")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({
        to: "/onboarding",
      });
    }

    const session = context.queryClient.getQueryData<AuthSessionData | null>(["auth", "session"]);
    const abilityRules = session?.abilityRules ?? [];
    updateAbility(abilityRules);

    return {
      abilityRules,
      can: ability.can.bind(ability),
      user,
    };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { impersonatedRole, stopImpersonating } = useAuth();
  const { settings } = useSettings();
  const sidebarId = "app-sidebar";
  const menuToggleButtonId = "mobile-menu-toggle";
  const wasMobileSidebarOpenRef = useRef(false);

  // Navigation state from TanStack Router
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const contentPaddingClass = useRouterState({
    select: (s) => {
      return s.location.pathname.startsWith("/clinical/day") ? "p-1 md:p-2" : "p-3 md:p-5";
    },
  });

  // Sidebar state: visible/hidden
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Detect if mobile/tablet (md breakpoint)
  const [isMobile, setIsMobile] = useState(!globalThis.matchMedia("(min-width: 768px)").matches);
  const [debouncedIsMobile] = useDebouncedValue(isMobile, { wait: 150 });

  useEffect(() => {
    const mql = globalThis.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
    };

    setIsMobile(!mql.matches);
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (debouncedIsMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [debouncedIsMobile]);

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
  };
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);
  const buildLabel = useMemo(() => {
    if (!BUILD_TIMESTAMP) {
      return undefined;
    }
    const parsed = new Date(BUILD_TIMESTAMP);
    if (Number.isNaN(parsed.getTime())) {
      return BUILD_TIMESTAMP;
    }
    return parsed.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  }, []);

  useEffect(() => {
    if (settings.pageTitle) {
      document.title = settings.pageTitle;
    }
  }, [settings.pageTitle]);

  useEffect(() => {
    if (!isMobile) {
      wasMobileSidebarOpenRef.current = false;
      return;
    }

    if (sidebarOpen) {
      wasMobileSidebarOpenRef.current = true;
      return;
    }

    if (wasMobileSidebarOpenRef.current) {
      const toggleButton = document.getElementById(menuToggleButtonId) as HTMLButtonElement | null;
      toggleButton?.focus();
    }

    wasMobileSidebarOpenRef.current = false;
  }, [isMobile, sidebarOpen]);

  // Handle PWA File Launch (macOS/Windows "Open With")
  useEffect(() => {
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
        await fileHandle.getFile();
      });
    }
  }, []);

  return (
    <>
      {/* Skip-link golden 2026: single position (absolute), hidden via
          large negative top + clip-path, revealed on focus by overriding
          top + clip-path. Avoids the position-class conflict that
          tailwindcss/no-conflicting-classes flags when mixing sr-only
          (position:absolute) with `fixed`. */}
      <Link
        className="absolute -top-32 left-3 z-110 [clip-path:inset(50%)] rounded-md bg-background px-3 py-2 font-semibold text-foreground shadow-lg focus:top-3 focus:[clip-path:none] focus:outline-none focus:ring-2 focus:ring-primary/70"
        href="#main-content"
      >
        Saltar al contenido principal
      </Link>
      {impersonatedRole && (
        <div className="sticky top-0 z-100 flex h-10 w-full items-center justify-center gap-4 bg-warning px-4 font-bold text-warning-foreground text-xs shadow-md">
          <span>VISTA PREVIA: {impersonatedRole.name}</span>
          <Button
            size="sm"
            variant="outline"
            className="border-none bg-black/20 text-current hover:bg-black/30"
            onPress={stopImpersonating}
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
      {/* Layout Shell.
          Mobile: `min-h-dvh`, no overflow clamp — the document/body is the
          scroll container (golden-2026: native momentum, pull-to-refresh,
          scroll restoration, iOS URL-bar collapse all work; a sticky
          Header + fixed BottomNav supply the chrome).
          ≥md: `h-dvh` + `overflow-hidden` — fixed app shell with the inset
          card scrolling internally (persistent sidebar rail + footer). */}
      <div className="layout-shell relative mx-auto flex min-h-dvh w-full gap-0 p-0 text-foreground md:h-dvh md:gap-4 md:overflow-hidden md:p-4">
        {/* Mobile nav toggle lives in-flow inside <Header> (see Header.tsx) —
            no fixed positioning, so it can't overlap the breadcrumb. */}

        {/* Sidebar */}
        <Sidebar
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          sidebarId={sidebarId}
        />

        {/* Main content */}
        <div className="layout-container flex min-w-0 flex-1 flex-col gap-3 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-[calc(110px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
          <Header onMenuToggle={toggleSidebar} sidebarId={sidebarId} sidebarOpen={sidebarOpen} />

          {/* Mobile: content flows in the document — no nested scroll, no
              `overflow-x` clamp (a clamp would silently clip real overflow
              bugs that layout-integrity.spec is meant to catch).
              ≥md: the inset recessed card scrolls internally. */}
          <main className="flex-1 md:overflow-hidden md:rounded-3xl" id="main-content" tabIndex={-1}>
            <RouteHeading />
            {/* Mobile: content sits directly on the page — no decorative
                recessed card (rounded border + inner shadow is desktop
                chrome that just eats width on a 375px screen).
                ≥md: the inset recessed card with its own scroll. */}
            <div className="w-full md:size-full md:overflow-hidden md:rounded-3xl md:border md:border-default-100/50 md:bg-background/50 md:shadow-inner">
              <div
                className={`${contentPaddingClass} md:size-full md:overflow-x-hidden md:overflow-y-auto`}
              >
                <Outlet />
              </div>
            </div>
          </main>

          <footer className="surface-elevated hidden px-4 py-2 text-foreground text-sm md:flex md:px-6">
            <div className="grid w-full grid-cols-3 items-center gap-2 text-xs">
              <span className="text-default-500">{buildLabel ? `Build: ${buildLabel}` : ""}</span>
              <div className="flex justify-center">
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      aria-label="Créditos"
                      className="min-w-0 px-2 text-danger"
                      size="sm"
                      variant="outline"
                    >
                      ♥
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    className="select-none whitespace-nowrap"
                    placement="top"
                    showArrow
                  >
                    Hecho con ♥ por Lucas Pulgar Escobar para Bioalergia
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <div className="flex justify-end">
                <DeploymentStatusChip />
              </div>
            </div>
          </footer>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav buildLabel={buildLabel} isHidden={isMobile && sidebarOpen} />

        {/* Update notification popup */}
        <UpdateNotification />
      </div>
    </>
  );
}
