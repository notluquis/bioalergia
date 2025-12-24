/**
 * Application Entry Point
 *
 * Uses unified route configuration as single source of truth.
 * All routes are generated automatically from shared/route-config.ts
 */

import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./i18n";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { GlobalError } from "./components/ui/GlobalError";
import { ChunkErrorBoundary } from "./components/ui/ChunkErrorBoundary";
import RequireAuth from "@/components/common/RequireAuth";
import PublicOnlyRoute from "@/components/common/PublicOnlyRoute";
import RouteErrorBoundary from "@/components/common/RouteErrorBoundary";
import { initPerformanceMonitoring } from "./lib/performance";
import { AbilityProvider } from "./lib/authz/AbilityProvider";
import PageLoader from "./components/ui/PageLoader";
import NotFoundPage from "./pages/NotFoundPage";

// Generate routes from unified config
import { generateRoutes } from "./lib/route-generator";

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
          <AuthProvider>
            <SettingsProvider>
              <ToastProvider>
                <AbilityProvider>
                  <RouterProvider router={router} />
                </AbilityProvider>
              </ToastProvider>
            </SettingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ChunkErrorBoundary>
    </GlobalError>
  </React.StrictMode>
);
