import { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./i18n";
import App from "./App";
// RequireAuth is defined locally
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";

import { GlobalError } from "./components/ui/GlobalError";
import { ChunkErrorBoundary } from "./components/ui/ChunkErrorBoundary";
import RequireAuth from "@/components/common/RequireAuth";
import PublicOnlyRoute from "@/components/common/PublicOnlyRoute";
import RouteErrorBoundary from "@/components/common/RouteErrorBoundary";

// Lazy loading de componentes principales
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("@/features/auth/pages/LoginPage"));
const SettingsLayout = lazy(() => import("./components/Layout/SettingsLayout"));

// Finance pages
const TransactionsMovements = lazy(() => import("@/features/finance/transactions/pages/TransactionsPage"));
const DailyBalances = lazy(() => import("@/features/finance/balances/pages/DailyBalancesPage"));
const LoansPage = lazy(() => import("@/features/finance/loans/pages/LoansPage"));
const ParticipantInsightsPage = lazy(() => import("./pages/ParticipantInsights"));

const EmployeesPage = lazy(() => import("@/features/hr/employees/pages/EmployeesPage"));
const TimesheetsPage = lazy(() => import("@/features/hr/timesheets/pages/TimesheetsPage"));
const TimesheetAuditPage = lazy(() => import("@/features/hr/timesheets-audit/pages/TimesheetAuditPage"));
const ReportsPage = lazy(() => import("@/features/hr/reports/pages/ReportsPage"));

const CounterpartsPage = lazy(() => import("./pages/Counterparts"));
// Lazy loading de layouts
const CalendarLayout = lazy(() => import("./components/Layout/CalendarLayout"));
const ServicesLayout = lazy(() => import("@/features/services/layout/ServicesLayout"));
const InventoryLayout = lazy(() => import("@/features/operations/layout/OperationsLayout"));
const HRLayout = lazy(() => import("@/features/hr/layout/HRLayout"));

const ServicesOverviewPage = lazy(() => import("@/features/services/pages/OverviewPage"));
const ServicesAgendaPage = lazy(() => import("@/features/services/pages/AgendaPage"));
const ServicesCreatePage = lazy(() => import("@/features/services/pages/CreateServicePage"));
const ServicesTemplatesPage = lazy(() => import("@/features/services/pages/TemplatesPage"));
const ServiceEditPage = lazy(() => import("@/features/services/pages/EditServicePage"));

const CalendarSummaryPage = lazy(() => import("./pages/CalendarSummaryPage"));
const CalendarSchedulePage = lazy(() => import("./pages/CalendarSchedulePage"));
const CalendarDailyPage = lazy(() => import("./pages/CalendarDailyPage"));
const CalendarHeatmapPage = lazy(() => import("./pages/CalendarHeatmapPage"));
const CalendarClassificationPage = lazy(() => import("./pages/CalendarClassificationPage"));
const CalendarSyncHistoryPage = lazy(() => import("./pages/CalendarSyncHistoryPage"));

const SuppliesPage = lazy(() => import("@/features/operations/supplies/pages/SuppliesPage"));
const InventoryPage = lazy(() => import("@/features/operations/inventory/pages/InventoryPage"));

// Settings pages
const UserManagementPage = lazy(() => import("@/features/users/pages/UserManagementPage"));
const PersonManagementPage = lazy(() => import("@/features/users/pages/PersonManagementPage"));
const PersonDetailsPage = lazy(() => import("./pages/settings/PersonDetailsPage"));

const CalendarSettingsPage = lazy(() => import("./pages/settings/CalendarSettingsPage"));
const InventorySettingsPage = lazy(() => import("./pages/settings/InventorySettingsPage"));
const RolesSettingsPage = lazy(() => import("./pages/settings/RolesSettingsPage"));
const ProductionBalancesPage = lazy(() => import("./pages/finanzas/ProductionBalancesPage"));
const SecuritySettingsPage = lazy(() => import("./pages/settings/SecuritySettingsPage"));
const AddUserPage = lazy(() => import("./pages/admin/AddUserPage"));
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard"));
const ChunkLoadErrorPage = lazy(() => import("./pages/ChunkLoadErrorPage"));

// Componente de loading
// Componente de loading
import PageLoader from "./components/ui/PageLoader";
import NotFoundPage from "./pages/NotFoundPage";

const router = createBrowserRouter([
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
  {
    path: "/",
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
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
        handle: { title: "Finanzas" },
        children: [
          { index: true, element: <Navigate to="movements" replace /> },
          {
            path: "movements",
            handle: { title: "Movimientos registrados" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <TransactionsMovements />
              </Suspense>
            ),
          },
          {
            path: "balances",
            handle: { title: "Saldos diarios" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <DailyBalances />
              </Suspense>
            ),
          },
          {
            path: "participants",
            handle: { title: "Participantes" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ParticipantInsightsPage />
              </Suspense>
            ),
          },
          {
            path: "counterparts",
            handle: { title: "Contrapartes" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CounterpartsPage />
              </Suspense>
            ),
          },
          {
            path: "loans",
            handle: { title: "Préstamos y créditos" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <LoansPage />
              </Suspense>
            ),
          },
          {
            path: "production-balances",
            handle: { title: "Balances de producción diaria" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ProductionBalancesPage />
              </Suspense>
            ),
          },
        ],
      },
      // Services Section
      {
        path: "/services",
        handle: { title: "Servicios" },
        element: (
          <Suspense fallback={<PageLoader />}>
            <ServicesLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            handle: { title: "Servicios recurrentes" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesOverviewPage />
              </Suspense>
            ),
          },
          {
            path: "agenda",
            handle: { title: "Agenda de servicios" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesAgendaPage />
              </Suspense>
            ),
          },
          {
            path: "create",
            handle: { title: "Crear servicio" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServicesCreatePage />
              </Suspense>
            ),
          },
          {
            path: ":id/edit",
            handle: { title: "Editar servicio" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ServiceEditPage />
              </Suspense>
            ),
          },
          {
            path: "templates",
            handle: { title: "Plantillas de servicios" },
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
        handle: { title: "Calendario" },
        element: (
          <Suspense fallback={<PageLoader />}>
            <CalendarLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="summary" replace /> },
          {
            path: "summary",
            handle: { title: "Eventos de calendario" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSummaryPage />
              </Suspense>
            ),
          },
          {
            path: "schedule",
            handle: { title: "Calendario interactivo" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSchedulePage />
              </Suspense>
            ),
          },
          {
            path: "daily",
            handle: { title: "Detalle diario" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarDailyPage />
              </Suspense>
            ),
          },
          {
            path: "heatmap",
            handle: { title: "Mapa de calor" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarHeatmapPage />
              </Suspense>
            ),
          },
          {
            path: "classify",
            handle: { title: "Clasificar eventos" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarClassificationPage />
              </Suspense>
            ),
          },
          {
            path: "history",
            handle: { title: "Historial de sincronización" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSyncHistoryPage />
              </Suspense>
            ),
          },
        ],
      },
      // Operations Section
      {
        path: "/operations",
        handle: { title: "Operaciones" },
        element: (
          <Suspense fallback={<PageLoader />}>
            <InventoryLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="inventory" replace /> },
          {
            path: "inventory",
            handle: { title: "Gestión de Inventario" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <InventoryPage />
              </Suspense>
            ),
          },
          {
            path: "supplies",
            handle: { title: "Solicitud de Insumos" },
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
        handle: { title: "RRHH" },
        element: (
          <Suspense fallback={<PageLoader />}>
            <HRLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="employees" replace /> },
          {
            path: "employees",
            handle: { title: "Trabajadores" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <EmployeesPage />
              </Suspense>
            ),
          },
          {
            path: "timesheets",
            handle: { title: "Horas y pagos" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <TimesheetsPage />
              </Suspense>
            ),
          },
          {
            path: "audit",
            handle: { title: "Auditoría de horarios" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <TimesheetAuditPage />
              </Suspense>
            ),
          },
          {
            path: "reports",
            handle: { title: "Reportes" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <ReportsPage />
              </Suspense>
            ),
          },
        ],
      },
      // Settings Section
      {
        path: "/settings",
        handle: { title: "Configuración" },
        element: (
          <Suspense fallback={<PageLoader />}>
            <SettingsLayout />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="security" replace />,
          },
          {
            path: "users",
            handle: { title: "Gestión de usuarios" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <UserManagementPage />
              </Suspense>
            ),
          },
          {
            path: "users/add",
            handle: { title: "Agregar usuario" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <AddUserPage />
              </Suspense>
            ),
          },
          {
            path: "people",
            handle: { title: "Gestión de personas" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <PersonManagementPage />
              </Suspense>
            ),
          },
          {
            path: "people/:id",
            handle: { title: "Detalles de persona" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <PersonDetailsPage />
              </Suspense>
            ),
          },

          {
            path: "calendar",
            handle: { title: "Accesos y conexiones" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <CalendarSettingsPage />
              </Suspense>
            ),
          },
          {
            path: "security",
            handle: { title: "Seguridad" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <SecuritySettingsPage />
              </Suspense>
            ),
          },
          {
            path: "inventario",
            handle: { title: "Parámetros de inventario" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <InventorySettingsPage />
              </Suspense>
            ),
          },
          {
            path: "roles",
            handle: { title: "Roles y permisos" },
            element: (
              <Suspense fallback={<PageLoader />}>
                <RolesSettingsPage />
              </Suspense>
            ),
          },
        ],
      },
      // Chunk Load Error page
      {
        path: "/chunk-load-error",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ChunkLoadErrorPage />
          </Suspense>
        ),
      },
      // Legacy Redirects (Optional but good for UX)
      { path: "/transactions/movements", element: <Navigate to="/finanzas/movements" replace /> },
      { path: "/transactions/balances", element: <Navigate to="/finanzas/balances" replace /> },
      { path: "/counterparts", element: <Navigate to="/finanzas/counterparts" replace /> },
      { path: "/transactions/participants", element: <Navigate to="/finanzas/participants" replace /> },
      { path: "/loans", element: <Navigate to="/finanzas/loans" replace /> },
      { path: "/employees", element: <Navigate to="/hr/employees" replace /> },
      { path: "/timesheets", element: <Navigate to="/hr/timesheets" replace /> },
      { path: "/inventory", element: <Navigate to="/operations/inventory" replace /> },
      { path: "/inventory/items", element: <Navigate to="/operations/inventory" replace /> },
      { path: "/supplies", element: <Navigate to="/operations/supplies" replace /> },
      { path: "/settings/inventory", element: <Navigate to="/settings/inventario" replace /> },
      { path: "/settings/finance", element: <Navigate to="/finanzas/production-balances" replace /> },
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
  <GlobalError>
    <ChunkErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ChunkErrorBoundary>
  </GlobalError>
);
