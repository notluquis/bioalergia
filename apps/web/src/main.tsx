/**
 * Application Entry Point
 *
 * Uses unified route configuration as single source of truth.
 * All routes are generated automatically from shared/route-config.ts
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
import { QuerySettingsProvider } from "@zenstackhq/tanstack-query/react";
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import PublicOnlyRoute from "@/components/guards/PublicOnlyRoute";
import RequireAuth from "@/components/guards/RequireAuth";
import RouteErrorBoundary from "@/components/guards/RouteErrorBoundary";

import App from "./App";
import { ChunkErrorBoundary } from "./components/ui/ChunkErrorBoundary";
import { GlobalError } from "./components/ui/GlobalError";
import PageLoader from "./components/ui/PageLoader";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { AbilityProvider } from "./lib/authz/AbilityProvider";
import { initPerformanceMonitoring } from "./lib/performance";
// Generate routes from unified config
import { generateRoutes } from "./lib/route-generator";
import NotFoundPage from "./pages/NotFoundPage";

// Pages that are outside the main route config
const Login = lazy(() => import("@/features/auth/pages/LoginPage"));
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard"));
const ChunkLoadErrorPage = lazy(() => import("./pages/ChunkLoadErrorPage"));
const Home = lazy(() => import("./pages/Home"));

// ============================================================================
// ROUTER CONFIGURATION
// ============================================================================

const router = createBrowserRouter(
  [
    // Public routes
    {
      path: "/login",
      element: (
        <PublicOnlyRoute>
          <Suspense fallback={<PageLoader />}>
            <Login />
          </Suspense>
        </PublicOnlyRoute>
      ),
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: "/onboarding",
      element: (
        <RequireAuth>
          <Suspense fallback={<PageLoader />}>
            <OnboardingWizard />
          </Suspense>
        </RequireAuth>
      ),
      errorElement: <RouteErrorBoundary />,
    },

    // Main authenticated app
    {
      path: "/",
      element: (
        <RequireAuth>
          <App />
        </RequireAuth>
      ),
      errorElement: <RouteErrorBoundary />,
      children: [
        // Home/Dashboard
        {
          index: true,
          element: (
            <Suspense fallback={<PageLoader />}>
              <Home />
            </Suspense>
          ),
        },

        // All app routes generated from config
        ...generateRoutes(),

        // Chunk load error page
        {
          path: "/chunk-load-error",
          element: (
            <Suspense fallback={<PageLoader />}>
              <ChunkLoadErrorPage />
            </Suspense>
          ),
        },
      ],
    },

    // 404 Not Found
    { path: "*", element: <NotFoundPage /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

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
                    <RouterProvider router={router} />
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
