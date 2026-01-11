/**
 * Application Entry Point
 *
 * MIGRATION NOTE: This file now uses TanStack Router for routing.
 * The old React Router v7 routes have been migrated to file-based routing in src/routes/.
 */

// Aggressive recovery from chunk load errors
// Clears all caches, unregisters service workers, then reloads
async function handleChunkLoadError() {
  console.warn("Chunk load error detected, clearing caches and reloading...");

  try {
    // Unregister all service workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      console.log("Service workers unregistered");
    }

    // Clear all caches
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log("All caches cleared:", cacheNames);
    }
  } catch (e) {
    console.error("Error during cache cleanup:", e);
  }

  // No forcing reload automatically. Use Error Boundary or Toast.
  console.debug("Preventing automatic reload for chunk error (manual reload required)");
}

// Global error handler for chunk load failures (runs before React mounts)
window.addEventListener("error", (event) => {
  const message = event.message || "";
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)) {
    handleChunkLoadError();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || String(event.reason) || "";
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)) {
    event.preventDefault();
    handleChunkLoadError();
  }
});

import "./index.css";
import "./i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QuerySettingsProvider } from "@zenstackhq/tanstack-query/react";
import React from "react";
import ReactDOM from "react-dom/client";

import { ChunkErrorBoundary } from "./components/ui/ChunkErrorBoundary";
import { GlobalError } from "./components/ui/GlobalError";
import PageLoader from "./components/ui/PageLoader";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { AbilityProvider } from "./lib/authz/AbilityProvider";
import { initPerformanceMonitoring } from "./lib/performance";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// ============================================================================
// REACT QUERY CLIENT
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
    mutations: {
      retry: false,
    },
  },
});

// ============================================================================
// TANSTACK ROUTER CONFIGURATION
// ============================================================================

// Create the router instance with context
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    // Auth will be injected at runtime via InnerApp
    auth: undefined!,
  },
  defaultPreload: "intent",
  defaultPendingComponent: PageLoader,
  // Integrate with React Query for cache invalidation on navigation
  defaultPreloadStaleTime: 0,
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

  return <RouterProvider router={router} context={{ auth }} />;
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

// Initialize performance monitoring
initPerformanceMonitoring();

// Render the app
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalError>
      <ChunkErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <QuerySettingsProvider value={{ endpoint: `${import.meta.env.VITE_API_URL || ""}/api/model` }}>
            <AuthProvider>
              <SettingsProvider>
                <ToastProvider>
                  <AbilityProvider>
                    <InnerApp />
                  </AbilityProvider>
                </ToastProvider>
              </SettingsProvider>
            </AuthProvider>
          </QuerySettingsProvider>
        </QueryClientProvider>
      </ChunkErrorBoundary>
    </GlobalError>
  </React.StrictMode>
);
