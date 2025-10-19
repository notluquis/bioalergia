import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import "./i18n";

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

const CounterpartsPage = lazy(() => import("./pages/Counterparts"));
const LoansPage = lazy(() => import("./pages/Loans"));
const ServicesLayout = lazy(() => import("./features/services/layout/ServicesLayout"));
const ServicesOverviewPage = lazy(() => import("./pages/ServicesOverviewPage"));
const ServicesAgendaPage = lazy(() => import("./pages/ServicesAgendaPage"));
const ServicesCreatePage = lazy(() => import("./pages/ServicesCreatePage"));
const ServiceEditPage = lazy(() => import("./pages/ServiceEditPage"));

const SuppliesPage = lazy(() => import("./pages/Supplies"));
const InventoryPage = lazy(() => import("./pages/Inventory"));
const CalendarSummaryPage = lazy(() => import("./pages/CalendarSummaryPage"));
const CalendarSchedulePage = lazy(() => import("./pages/CalendarSchedulePage"));
const CalendarDailyPage = lazy(() => import("./pages/CalendarDailyPage"));
const CalendarSyncHistoryPage = lazy(() => import("./pages/CalendarSyncHistoryPage"));
const CalendarHeatmapPage = lazy(() => import("./pages/CalendarHeatmapPage"));
const CalendarClassificationPage = lazy(() => import("./pages/CalendarClassificationPage"));

// Settings pages
const GeneralSettingsPage = lazy(() => import("./pages/settings/GeneralSettingsPage"));
const AccessSettingsPage = lazy(() => import("./pages/settings/AccessSettingsPage"));
const InventorySettingsPage = lazy(() => import("./pages/settings/InventorySettingsPage"));
const RolesSettingsPage = lazy(() => import("./pages/settings/RolesSettingsPage"));
const CalendarSettingsPage = lazy(() => import("./pages/settings/CalendarSettingsPage"));

// Componente de loading
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="text-[var(--brand-primary)] font-medium">Cargando...</div>
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
                <ServicesOverviewPage />
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
      { path: "/calendar", element: <Navigate to="/calendar/summary" replace /> },
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
            path: "calendar",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSettingsPage />
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
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function RootApp() {
  return (
    <React.StrictMode>
      <AuthProvider>
        <SettingsProvider>
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
              <RouterProvider router={router} />
            </ErrorBoundary>
          </QueryClientProvider>
        </SettingsProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontró el elemento root para montar la aplicación");
}

ReactDOM.createRoot(rootElement).render(<RootApp />);
