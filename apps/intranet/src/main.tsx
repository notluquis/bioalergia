/**
 * Application Entry Point
 *
 * MIGRATION NOTE: This file now uses TanStack Router for routing.
 * The old React Router v7 routes have been migrated to file-based routing in src/routes/.
 */

import { Button } from "@heroui/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { lazy, StrictMode, Suspense, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ZodError } from "zod";
import { AuthListener } from "@/features/auth/components/AuthListener";
import { ApiError } from "@/lib/api-client";
import { AppFallback } from "./components/features/AppFallback";
import { ChunkErrorBoundary } from "./components/ui/ChunkErrorBoundary";
import { GlobalError } from "./components/ui/GlobalError";
import { useAuth } from "./context/AuthContext";
import { ConfirmDialogProvider } from "./context/ConfirmDialogContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import type { AuthContextType } from "./features/auth/hooks/use-auth";
import { signalAppFallback } from "./lib/app-recovery";
import { AbilityProvider } from "./lib/authz/AbilityProvider";
import { createLogger } from "./lib/logger";
import { initPerformanceMonitoring } from "./lib/performance";
import { initSentry, isSentryEnabled, Sentry } from "./lib/sentry";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";
// Initialize global dayjs configuration
import "@/lib/dayjs";

import "./index.css";
import "./i18n";

// Initialize Sentry as early as possible — Sentry's browser-tracing docs
// require this so the pageload span starts at boot (it's retroactively
// backdated to the browser request-start) and so early chunk-load errors
// are captured. browserTracingIntegration's fetch/XHR wrapping is
// microsecond-level overhead; the actual prod-latency risk was the
// lazy-loaded Replay integration, which has been removed from
// initSentry() (see src/lib/sentry.ts). No-op when VITE_SENTRY_DSN unset.
initSentry();

// Create namespaced logger for chunk errors
const log = createLogger("ChunkRecovery");

// Regex for chunk load errors
const CHUNK_ERROR_REGEX =
  /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;

// Global error handler for chunk load failures (runs before React mounts)
globalThis.addEventListener("error", (event) => {
  const message = event.message;
  if (CHUNK_ERROR_REGEX.test(message)) {
    log.warn("Chunk load error detected. Awaiting user recovery action.");
    signalAppFallback("chunk");
  }
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const message = (event.reason?.message ?? String(event.reason)) as string;
  if (CHUNK_ERROR_REGEX.test(message)) {
    event.preventDefault();
    log.warn("Chunk load rejection detected. Awaiting user recovery action.");
    signalAppFallback("chunk");
  }
});

// ============================================================================
// GLOBAL ERROR LOGGING
// ============================================================================

function logGlobalError(error: unknown, context: string) {
  if (error instanceof ZodError) {
    console.group(`🚨 [${context}] Validation Error`);
    console.table(
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }))
    );
    console.groupEnd();
  } else if (error instanceof ApiError && error.details) {
    console.group(`🚨 [${context}] ApiError`);
    console.error(error.message);
    console.groupEnd();
  } else {
    // Standard error logging
    console.group(`🚨 [${context}] Error`);
    console.error(error);
    console.groupEnd();
  }
}

// ============================================================================
// REACT QUERY CLIENT
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
      onError: (error) => logGlobalError(error, "Mutation"),
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 60_000,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => logGlobalError(error, "Query"),
  }),
  mutationCache: new MutationCache({
    onError: (error) => logGlobalError(error, "Mutation"),
  }),
});

// ============================================================================
// TANSTACK ROUTER CONFIGURATION
// ============================================================================

// Create the router instance with context
const router = createRouter({
  context: {
    // Auth will be injected at runtime via InnerApp
    auth: undefined as unknown as AuthContextType,
    queryClient,
  },
  defaultPendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner label="Cargando" color="accent" size="lg" />
    </div>
  ),
  defaultPreload: "intent",
  // Integrate with React Query for cache invalidation on navigation
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ({ error }) => {
    // Log the error immediately
    useEffect(() => {
      logGlobalError(error, "Router");
      if (isSentryEnabled()) {
        Sentry.captureException(error, { tags: { source: "tanstack-router" } });
      }
    }, [error]);

    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
        <div className="max-w-lg rounded-2xl border border-danger-soft-hover bg-danger/10 p-6 text-center text-danger">
          <h2 className="mb-2 font-bold text-xl">Error de Navegación</h2>
          <p className="whitespace-pre-wrap text-sm opacity-90">
            {error instanceof Error ? error.message : "Un error inesperado ha ocurrido."}
          </p>
          <Button className="mt-6" variant="danger" onPress={() => window.location.reload()}>
            Recargar Página
          </Button>
        </div>
      </div>
    );
  },
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
    : lazy(() =>
        import("@tanstack/react-query-devtools").then((res) => ({
          default: res.ReactQueryDevtools,
        }))
      );

// ============================================================================
// INITIALIZE APP
// ============================================================================

// Initialize performance monitoring
initPerformanceMonitoring();

// Mint csrf_token cookie before any oRPC POST. The server's
// csrf-double-submit middleware would otherwise reject the very first
// state-changing request after a cold load. Fire-and-forget — failures
// are tolerated and the in-flight retry inside csrfFetch covers them.
fetch("/api/csrf", { credentials: "include" }).catch(() => undefined);

// Render the app
const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Root element #root no encontrado");
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <AppFallback />
    <GlobalError>
      <ChunkErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthListener />
          <SettingsProvider>
            <ConfirmDialogProvider>
              <ToastProvider>
                <AbilityProvider>
                  <InnerApp />
                  <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} />
                  </Suspense>
                </AbilityProvider>
              </ToastProvider>
            </ConfirmDialogProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </ChunkErrorBoundary>
    </GlobalError>
  </StrictMode>
);
