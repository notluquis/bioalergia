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
import RequirePermission from "@/components/common/RequirePermission";
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
const CSVUploadPage = lazy(() => import("./pages/settings/CSVUploadPage"));

// Componente de loading
// Componente de loading
import PageLoader from "./components/ui/PageLoader";
import NotFoundPage from "./pages/NotFoundPage";

const router = createBrowserRouter(
  [
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
                <RequirePermission action="read" subject="Transaction">
                  <Suspense fallback={<PageLoader />}>
                    <TransactionsMovements />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "balances",
              handle: { title: "Saldos diarios" },
              element: (
                <RequirePermission action="read" subject="Transaction">
                  <Suspense fallback={<PageLoader />}>
                    <DailyBalances />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "participants",
              handle: { title: "Participantes" },
              element: (
                <RequirePermission action="read" subject="Person">
                  <Suspense fallback={<PageLoader />}>
                    <ParticipantInsightsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "counterparts",
              handle: { title: "Contrapartes" },
              element: (
                <RequirePermission action="read" subject="Counterpart">
                  <Suspense fallback={<PageLoader />}>
                    <CounterpartsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "loans",
              handle: { title: "Préstamos y créditos" },
              element: (
                <RequirePermission action="read" subject="Loan">
                  <Suspense fallback={<PageLoader />}>
                    <LoansPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "production-balances",
              handle: { title: "Balances de producción diaria" },
              element: (
                <RequirePermission action="read" subject="ProductionBalance">
                  <Suspense fallback={<PageLoader />}>
                    <ProductionBalancesPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
          ],
        },
        // Services Section
        {
          path: "/services",
          handle: { title: "Servicios" },
          element: (
            <RequirePermission action="read" subject="Service">
              <Suspense fallback={<PageLoader />}>
                <ServicesLayout />
              </Suspense>
            </RequirePermission>
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
                <RequirePermission action="manage" subject="Service">
                  <Suspense fallback={<PageLoader />}>
                    <ServicesCreatePage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: ":id/edit",
              handle: { title: "Editar servicio" },
              element: (
                <RequirePermission action="manage" subject="Service">
                  <Suspense fallback={<PageLoader />}>
                    <ServiceEditPage />
                  </Suspense>
                </RequirePermission>
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
            <RequirePermission action="read" subject="CalendarEvent">
              <Suspense fallback={<PageLoader />}>
                <CalendarLayout />
              </Suspense>
            </RequirePermission>
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
            <RequirePermission action="read" subject="InventoryItem">
              <Suspense fallback={<PageLoader />}>
                <InventoryLayout />
              </Suspense>
            </RequirePermission>
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
                <RequirePermission action="read" subject="SupplyRequest">
                  <Suspense fallback={<PageLoader />}>
                    <SuppliesPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
          ],
        },
        // HR Section
        {
          path: "/hr",
          handle: { title: "RRHH" },
          element: (
            <RequirePermission action="read" subject="Employee">
              <Suspense fallback={<PageLoader />}>
                <HRLayout />
              </Suspense>
            </RequirePermission>
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
                <RequirePermission action="read" subject="Timesheet">
                  <Suspense fallback={<PageLoader />}>
                    <TimesheetsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "audit",
              handle: { title: "Auditoría de horarios" },
              element: (
                <RequirePermission action="read" subject="Timesheet">
                  <Suspense fallback={<PageLoader />}>
                    <TimesheetAuditPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "reports",
              handle: { title: "Reportes" },
              element: (
                <RequirePermission action="read" subject="Report">
                  <Suspense fallback={<PageLoader />}>
                    <ReportsPage />
                  </Suspense>
                </RequirePermission>
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
                <RequirePermission action="read" subject="User">
                  <Suspense fallback={<PageLoader />}>
                    <UserManagementPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "users/add",
              handle: { title: "Agregar usuario" },
              element: (
                <RequirePermission action="create" subject="User">
                  <Suspense fallback={<PageLoader />}>
                    <AddUserPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "people",
              handle: { title: "Gestión de personas" },
              element: (
                <RequirePermission action="read" subject="Person">
                  <Suspense fallback={<PageLoader />}>
                    <PersonManagementPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "people/:id",
              handle: { title: "Detalles de persona" },
              element: (
                <RequirePermission action="read" subject="Person">
                  <Suspense fallback={<PageLoader />}>
                    <PersonDetailsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            // Settings Pages
            {
              path: "calendar",
              handle: { title: "Accesos y conexiones" },
              element: (
                <RequirePermission action="manage" subject="CalendarEvent">
                  <Suspense fallback={<PageLoader />}>
                    <CalendarSettingsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "security",
              handle: { title: "Seguridad" },
              element: (
                <RequirePermission action="manage" subject="Setting">
                  <Suspense fallback={<PageLoader />}>
                    <SecuritySettingsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "inventario",
              handle: { title: "Parámetros de inventario" },
              element: (
                <RequirePermission action="manage" subject="InventoryItem">
                  <Suspense fallback={<PageLoader />}>
                    <InventorySettingsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "roles",
              handle: { title: "Roles y permisos" },
              element: (
                <RequirePermission action="manage" subject="Role">
                  <Suspense fallback={<PageLoader />}>
                    <RolesSettingsPage />
                  </Suspense>
                </RequirePermission>
              ),
            },
            {
              path: "csv-upload",
              handle: { title: "Carga masiva de datos" },
              element: (
                <RequirePermission action="manage" subject="Setting">
                  <Suspense fallback={<PageLoader />}>
                    <CSVUploadPage />
                  </Suspense>
                </RequirePermission>
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
        { path: "/reports", element: <Navigate to="/hr/reports" replace /> },
        { path: "/settings/general", element: <Navigate to="/settings" replace /> },
      ],
    },
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

import { AbilityProvider } from "./lib/authz/AbilityProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
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
);
