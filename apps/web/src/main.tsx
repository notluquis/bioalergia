/**
 * Application Entry Point
 *
 * MIGRATION NOTE: This file now uses TanStack Router for routing.
 * The old React Router v7 routes have been migrated to file-based routing in src/routes/.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QuerySettingsProvider } from "@zenstackhq/tanstack-query/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { AppFallback } from "./components/features/AppFallback";
import { ChunkErrorBoundary } from "./components/ui/ChunkErrorBoundary";
import { GlobalError } from "./components/ui/GlobalError";
import PageLoader from "./components/ui/PageLoader";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { signalAppFallback } from "./lib/app-recovery";
import { AbilityProvider } from "./lib/authz/AbilityProvider";
import { createLogger } from "./lib/logger";
import { initPerformanceMonitoring } from "./lib/performance";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./index.css";
import "./i18n";

// Create namespaced logger for chunk errors
const log = createLogger("ChunkRecovery");

// Global error handler for chunk load failures (runs before React mounts)
globalThis.addEventListener("error", (event) => {
  const message = event.message;
  if (
    /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message,
    )
  ) {
    log.warn("Chunk load error detected. Awaiting user recovery action.");
    signalAppFallback("chunk");
  }
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message ?? String(event.reason);
  if (
    /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message,
    )
  ) {
    event.preventDefault();
    log.warn("Chunk load rejection detected. Awaiting user recovery action.");
    signalAppFallback("chunk");
  }
});

// ============================================================================
// REACT QUERY CLIENT
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 60_000,
    },
  },
});

// ============================================================================
// TANSTACK ROUTER CONFIGURATION
// ============================================================================

// Create the router instance with context
const router = createRouter({
  context: {
    // Auth will be injected at runtime via InnerApp
    // biome-ignore lint/style/noNonNullAssertion: context injection
    auth: undefined!,
    queryClient,
  },
  defaultPendingComponent: PageLoader,
  defaultPreload: "intent",
  // Integrate with React Query for cache invalidation on navigation
  defaultPreloadStaleTime: 0,
  routeTree,
});

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ============================================================================
// INNER APP (with auth context available)
// ============================================================================

function InnerApp() {
  const auth = useAuth();

  return <RouterProvider context={{ auth }} router={router} />;
}

// Lazy load devtools for development only
const ReactQueryDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/react-query-devtools").then((res) => ({
          default: res.ReactQueryDevtools,
        })),
      );

// ============================================================================
// INITIALIZE APP
// ============================================================================

// Initialize performance monitoring
initPerformanceMonitoring();

// Render the app
// biome-ignore lint/style/noNonNullAssertion: root element exists
ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <AppFallback />
    <GlobalError>
      <ChunkErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <QuerySettingsProvider
            value={{
              endpoint: import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/api/model`
                : "/api/model",
            }}
          >
            <AuthProvider>
              <SettingsProvider>
                <ToastProvider>
                  <AbilityProvider>
                    <InnerApp />
                    <React.Suspense fallback={null}>
                      <ReactQueryDevtools initialIsOpen={false} />
                    </React.Suspense>
                  </AbilityProvider>
                </ToastProvider>
              </SettingsProvider>
            </AuthProvider>
          </QuerySettingsProvider>
        </QueryClientProvider>
      </ChunkErrorBoundary>
    </GlobalError>
  </React.StrictMode>,
);
