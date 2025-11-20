import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./i18n";
import App from "./App";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BUILD_ID } from "./version";

// Lazy loading de componentes principales
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Settings = lazy(() => import("./pages/Settings"));

// Lazy loading por features
const TransactionsMovements = lazy(() => import("./pages/TransactionsMovements"));
const DailyBalances = lazy(() => import("./pages/DailyBalances"));
const ParticipantInsightsPage = lazy(() => import("./pages/ParticipantInsights"));

const Upload = lazy(() => import("./pages/Upload"));
const Stats = lazy(() => import("./pages/Stats"));

const EmployeesPage = lazy(() => import("./pages/Employees"));
const TimesheetsPage = lazy(() => import("./pages/Timesheets"));
const TimesheetAuditPage = lazy(() => import("./pages/TimesheetAuditPage"));

const CounterpartsPage = lazy(() => import("./pages/Counterparts"));
const LoansPage = lazy(() => import("./pages/Loans"));
const ServicesLayout = lazy(() => import("./pages/services/ServicesLayout"));
const ServicesPage = lazy(() => import("./pages/ServicesOverviewPage"));
const ServicesAgendaPage = lazy(() => import("./pages/ServicesAgendaPage"));
const ServicesCreatePage = lazy(() => import("./pages/ServicesCreatePage"));
const ServicesTemplatesPage = lazy(() => import("./pages/ServicesTemplatesPage"));
const ServiceEditPage = lazy(() => import("./pages/ServiceEditPage"));
const CalendarSummaryPage = lazy(() => import("./pages/CalendarSummaryPage"));
const CalendarSchedulePage = lazy(() => import("./pages/CalendarSchedulePage"));
const CalendarDailyPage = lazy(() => import("./pages/CalendarDailyPage"));
const CalendarHeatmapPage = lazy(() => import("./pages/CalendarHeatmapPage"));
const CalendarClassificationPage = lazy(() => import("./pages/CalendarClassificationPage"));
const CalendarSyncHistoryPage = lazy(() => import("./pages/CalendarSyncHistoryPage"));

const SuppliesPage = lazy(() => import("./pages/Supplies"));
const InventoryPage = lazy(() => import("./pages/Inventory"));

// Settings pages
const GeneralSettingsPage = lazy(() => import("./pages/settings/GeneralSettingsPage"));
const AccessSettingsPage = lazy(() => import("./pages/settings/AccessSettingsPage"));
const InventorySettingsPage = lazy(() => import("./pages/settings/InventorySettingsPage"));
const RolesSettingsPage = lazy(() => import("./pages/settings/RolesSettingsPage"));

// Componente de loading
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="text-primary font-medium">Cargando...</div>
  </div>
);

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      {
        path: "/",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Home />
          </Suspense>
        ),
      },
      {
        path: "/employees",
        element: (
          <Suspense fallback={<PageLoader />}>
            <EmployeesPage />
          </Suspense>
        ),
      },
      {
        path: "/upload",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Upload />
          </Suspense>
        ),
      },
      {
        path: "/transactions/movements",
        element: (
          <Suspense fallback={<PageLoader />}>
            <TransactionsMovements />
          </Suspense>
        ),
      },
      {
        path: "/transactions/balances",
        element: (
          <Suspense fallback={<PageLoader />}>
            <DailyBalances />
          </Suspense>
        ),
      },
      {
        path: "/transactions/participants",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ParticipantInsightsPage />
          </Suspense>
        ),
      },
      {
        path: "/counterparts",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CounterpartsPage />
          </Suspense>
        ),
      },
      {
        path: "/loans",
        element: (
          <Suspense fallback={<PageLoader />}>
            <LoansPage />
          </Suspense>
        ),
      },
      {
        path: "/services",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ServicesLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesPage />
              </Suspense>
            ),
          },
          {
            path: "agenda",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesAgendaPage />
              </Suspense>
            ),
          },
          {
            path: "create",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesCreatePage />
              </Suspense>
            ),
          },
          {
            path: ":id/edit",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServiceEditPage />
              </Suspense>
            ),
          },
          {
            path: "templates",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesTemplatesPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "/timesheets",
        element: (
          <Suspense fallback={<PageLoader />}>
            <TimesheetsPage />
          </Suspense>
        ),
      },
      {
        path: "/timesheets-audit",
        element: (
          <Suspense fallback={<PageLoader />}>
            <TimesheetAuditPage />
          </Suspense>
        ),
      },
      {
        path: "/supplies",
        element: (
          <Suspense fallback={<PageLoader />}>
            <SuppliesPage />
          </Suspense>
        ),
      },
      { path: "/data", element: <Navigate to="/transactions/movements" replace /> },
      {
        path: "/stats",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Stats />
          </Suspense>
        ),
      },
      {
        path: "/settings",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Settings />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="general" replace /> },
          {
            path: "general",
            element: (
              <Suspense fallback={<PageLoader />}>
                <GeneralSettingsPage />
              </Suspense>
            ),
          },
          {
            path: "accesos",
            element: (
              <Suspense fallback={<PageLoader />}>
                <AccessSettingsPage />
              </Suspense>
            ),
          },
          {
            path: "inventario",
            element: (
              <Suspense fallback={<PageLoader />}>
                <InventorySettingsPage />
              </Suspense>
            ),
          },
          {
            path: "roles",
            element: (
              <Suspense fallback={<PageLoader />}>
                <RolesSettingsPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "/inventory",
        element: (
          <Suspense fallback={<PageLoader />}>
            <InventoryPage />
          </Suspense>
        ),
      },
      {
        path: "/calendar/summary",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarSummaryPage />
          </Suspense>
        ),
      },
      {
        path: "/calendar/schedule",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarSchedulePage />
          </Suspense>
        ),
      },
      {
        path: "/calendar/daily",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarDailyPage />
          </Suspense>
        ),
      },
      {
        path: "/calendar/heatmap",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarHeatmapPage />
          </Suspense>
        ),
      },
      {
        path: "/calendar/classify",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarClassificationPage />
          </Suspense>
        ),
      },
      {
        path: "/calendar/history",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarSyncHistoryPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <ErrorBoundary>
              <RouterProvider router={router} />
            </ErrorBoundary>
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// Register service worker for PWA support
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        console.log("SW registered:", { registration, buildId: BUILD_ID });

        const requestSkipWaiting = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };

        requestSkipWaiting();

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        registration.update();
      })
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  });
}
