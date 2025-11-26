import { Suspense, lazy, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./i18n";
import App from "./App";
// RequireAuth is defined locally
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

// Lazy loading de componentes principales
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const SettingsLayout = lazy(() => import("./components/Layout/SettingsLayout"));

// Lazy loading por features
const TransactionsMovements = lazy(() => import("./pages/TransactionsMovements"));
const DailyBalances = lazy(() => import("./pages/DailyBalances"));
const ParticipantInsightsPage = lazy(() => import("./pages/ParticipantInsights"));

const EmployeesPage = lazy(() => import("./pages/Employees"));
const TimesheetsPage = lazy(() => import("./pages/Timesheets"));
const TimesheetAuditPage = lazy(() => import("./pages/TimesheetAuditPage"));

const CounterpartsPage = lazy(() => import("./pages/Counterparts"));
const LoansPage = lazy(() => import("./pages/Loans"));
// Lazy loading de layouts
const FinanceLayout = lazy(() => import("./components/Layout/FinanceLayout"));
const CalendarLayout = lazy(() => import("./components/Layout/CalendarLayout"));
const ServicesLayout = lazy(() => import("./components/Layout/ServicesLayout"));
const InventoryLayout = lazy(() => import("./components/Layout/InventoryLayout"));
const HRLayout = lazy(() => import("./components/Layout/HRLayout"));

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
const UserManagementPage = lazy(() => import("./pages/settings/UserManagementPage"));
const PersonManagementPage = lazy(() => import("./pages/settings/PersonManagementPage"));
const PersonDetailsPage = lazy(() => import("./pages/settings/PersonDetailsPage"));
const GeneralSettingsPage = lazy(() => import("./pages/settings/GeneralSettingsPage"));
const CalendarSettingsPage = lazy(() => import("./pages/settings/CalendarSettingsPage"));
const AccessSettingsPage = lazy(() => import("./pages/settings/AccessSettingsPage"));
const InventorySettingsPage = lazy(() => import("./pages/settings/InventorySettingsPage"));
const RolesSettingsPage = lazy(() => import("./pages/settings/RolesSettingsPage"));
const DailyProductionBalancesSettingsPage = lazy(() => import("./pages/settings/DailyProductionBalancesPage"));
const SecuritySettingsPage = lazy(() => import("./pages/settings/SecuritySettingsPage"));
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard"));

// Componente de loading
// Componente de loading
import PageLoader from "./components/ui/PageLoader";
import NotFoundPage from "./pages/NotFoundPage";

// Wrapper to protect routes and handle onboarding redirect
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to onboarding if pending setup
  if (user.status === "PENDING_SETUP" && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent access to onboarding if already active
  if (user.status === "ACTIVE" && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  return children;
}

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
    path: "/onboarding",
    element: (
      <RequireAuth>
        <Suspense fallback={<PageLoader />}>
          <OnboardingWizard />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    errorElement: (
      <ErrorBoundary>
        <div>Error loading app</div>
      </ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Home />
          </Suspense>
        ),
      },
      // Finanzas Section
      {
        path: "/finanzas",
        element: (
          <Suspense fallback={<PageLoader />}>
            <FinanceLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="movements" replace /> },
          {
            path: "movements",
            element: (
              <Suspense fallback={<PageLoader />}>
                <TransactionsMovements />
              </Suspense>
            ),
          },
          {
            path: "balances",
            element: (
              <Suspense fallback={<PageLoader />}>
                <DailyBalances />
              </Suspense>
            ),
          },
          {
            path: "participants",
            element: (
              <Suspense fallback={<PageLoader />}>
                <ParticipantInsightsPage />
              </Suspense>
            ),
          },
          {
            path: "counterparts",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CounterpartsPage />
              </Suspense>
            ),
          },
          {
            path: "loans",
            element: (
              <Suspense fallback={<PageLoader />}>
                <LoansPage />
              </Suspense>
            ),
          },
          {
            path: "production-balances",
            element: (
              <Suspense fallback={<PageLoader />}>
                <DailyProductionBalancesSettingsPage />
              </Suspense>
            ),
          },
        ],
      },
      // Services Section
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
      // Calendar Section
      {
        path: "/calendar",
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="summary" replace /> },
          {
            path: "summary",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSummaryPage />
              </Suspense>
            ),
          },
          {
            path: "schedule",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSchedulePage />
              </Suspense>
            ),
          },
          {
            path: "daily",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarDailyPage />
              </Suspense>
            ),
          },
          {
            path: "heatmap",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarHeatmapPage />
              </Suspense>
            ),
          },
          {
            path: "classify",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarClassificationPage />
              </Suspense>
            ),
          },
          {
            path: "history",
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSyncHistoryPage />
              </Suspense>
            ),
          },
        ],
      },
      // Inventory/Operations Section
      {
        path: "/inventory",
        element: (
          <Suspense fallback={<PageLoader />}>
            <InventoryLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="items" replace /> },
          {
            path: "items",
            element: (
              <Suspense fallback={<PageLoader />}>
                <InventoryPage />
              </Suspense>
            ),
          },
          {
            path: "supplies",
            element: (
              <Suspense fallback={<PageLoader />}>
                <SuppliesPage />
              </Suspense>
            ),
          },
        ],
      },
      // HR Section
      {
        path: "/hr",
        element: (
          <Suspense fallback={<PageLoader />}>
            <HRLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="employees" replace /> },
          {
            path: "employees",
            element: (
              <Suspense fallback={<PageLoader />}>
                <EmployeesPage />
              </Suspense>
            ),
          },
          {
            path: "timesheets",
            element: (
              <Suspense fallback={<PageLoader />}>
                <TimesheetsPage />
              </Suspense>
            ),
          },
          {
            path: "audit",
            element: (
              <Suspense fallback={<PageLoader />}>
                <TimesheetAuditPage />
              </Suspense>
            ),
          },
        ],
      },
      // Settings Section
      {
        path: "/settings",
        element: (
          <Suspense fallback={<PageLoader />}>
            <SettingsLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="users" replace />,
          },
          {
            path: "users",
            element: (
              <Suspense fallback={<PageLoader />}>
                <UserManagementPage />
              </Suspense>
            ),
          },
          {
            path: "people",
            element: (
              <Suspense fallback={<PageLoader />}>
                <PersonManagementPage />
              </Suspense>
            ),
          },
          {
            path: "people/:id",
            element: (
              <Suspense fallback={<PageLoader />}>
                <PersonDetailsPage />
              </Suspense>
            ),
          },
          {
            path: "general",
            element: (
              <Suspense fallback={<PageLoader />}>
                <GeneralSettingsPage />
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
            path: "security",
            element: (
              <Suspense fallback={<PageLoader />}>
                <SecuritySettingsPage />
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
      // Legacy Redirects (Optional but good for UX)
      { path: "/transactions/movements", element: <Navigate to="/finanzas/movements" replace /> },
      { path: "/transactions/balances", element: <Navigate to="/finanzas/balances" replace /> },
      { path: "/counterparts", element: <Navigate to="/finanzas/counterparts" replace /> },
      { path: "/transactions/participants", element: <Navigate to="/finanzas/participants" replace /> },
      { path: "/loans", element: <Navigate to="/finanzas/loans" replace /> },
      { path: "/employees", element: <Navigate to="/hr/employees" replace /> },
      { path: "/timesheets", element: <Navigate to="/hr/timesheets" replace /> },
      { path: "/supplies", element: <Navigate to="/inventory/supplies" replace /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

import { initPerformanceMonitoring } from "./lib/performance";

// Initialize performance mode (Low vs High end)
initPerformanceMonitoring();

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
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

// Service Worker Registration - with aggressive update strategy
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  import("./lib/serviceWorker").then(({ registerServiceWorker }) => {
    registerServiceWorker();
  });
}
