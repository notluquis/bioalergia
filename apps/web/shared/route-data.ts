/**
 * Navigation Data - Shared between client and server
 *
 * This file contains ONLY data (no component imports).
 * Used by:
 * - Client: nav-generator.ts, route-generator.tsx
 * - Server: permissions.ts for syncing permissions
 */

// ============================================================================
// TYPES
// ============================================================================

export type NavSection = "Calendario" | "Finanzas" | "Servicios" | "Operaciones" | "Sistema";

export interface RoutePermission {
  action: string;
  subject: string;
}

export interface NavConfig {
  /** Label shown in sidebar */
  label: string;
  /** Lucide icon name */
  iconKey: string;
  /** Section grouping in sidebar */
  section: NavSection;
  /** Sort order within section (lower = higher) */
  order: number;
}

export interface RouteData {
  /** URL path segment (relative to parent). Optional if index is true. */
  path?: string;

  /**
   * Component path for lazy loading (relative to src/)
   * Example: "pages/CalendarSchedulePage", "features/finance/transactions/pages/TransactionsPage"
   */
  componentPath?: string;

  /**
   * Navigation config - if present, route appears in sidebar
   * If undefined, route exists but is not shown in navigation
   */
  nav?: NavConfig;

  /** Required permission to access this route */
  permission?: RoutePermission;

  /** Route metadata (used for breadcrumbs, page title) */
  title?: string;

  /** If true, only match exact path (for index routes) */
  exact?: boolean;

  /** Nested child routes */
  children?: RouteData[];

  /** If true, this is an index route (renders at parent path) */
  index?: boolean;

  /** Redirect to another path */
  redirectTo?: string;
}

// ============================================================================
// ROUTE DATA (no component imports - safe for server)
// ============================================================================

export const ROUTE_DATA: RouteData[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // HOME / DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "",
    componentPath: "pages/Home",
    nav: { label: "Inicio", iconKey: "Home", section: "Calendario", order: 0 },
    permission: { action: "read", subject: "Dashboard" },
    title: "Inicio",
    exact: true,
  },
  // ══════════════════════════════════════════════════════════════════════════
  // CALENDAR SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "calendar",
    componentPath: "components/Layout/CalendarLayout",
    permission: { action: "read", subject: "CalendarEvent" },
    title: "Calendario",
    children: [
      { index: true, redirectTo: "/calendar/schedule" },
      {
        path: "schedule",
        componentPath: "pages/CalendarSchedulePage",
        nav: { label: "Calendario", iconKey: "CalendarDays", section: "Calendario", order: 1 },
        permission: { action: "read", subject: "CalendarEvent" },
        title: "Calendario interactivo",
      },
      {
        path: "daily",
        componentPath: "pages/CalendarDailyPage",
        nav: { label: "Detalle Diario", iconKey: "Calendar", section: "Calendario", order: 2 },
        permission: { action: "read", subject: "CalendarEvent" },
        title: "Detalle diario",
      },
      {
        path: "heatmap",
        componentPath: "pages/CalendarHeatmapPage",
        nav: { label: "Mapa de Calor", iconKey: "LayoutDashboard", section: "Calendario", order: 3 },
        permission: { action: "read", subject: "CalendarEvent" },
        title: "Mapa de calor",
      },
      {
        path: "classify",
        componentPath: "pages/CalendarClassificationPage",
        nav: { label: "Clasificar", iconKey: "ListChecks", section: "Calendario", order: 4 },
        permission: { action: "update", subject: "CalendarEvent" },
        title: "Clasificar eventos",
      },
      {
        path: "sync-history",
        componentPath: "pages/CalendarSyncHistoryPage",
        nav: { label: "Historial Sync", iconKey: "Clock", section: "Calendario", order: 5 },
        permission: { action: "read", subject: "CalendarEvent" },
        title: "Historial de sincronización",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINANZAS SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "finanzas",
    title: "Finanzas",
    children: [
      { index: true, redirectTo: "/finanzas/movements" },
      {
        path: "movements",
        componentPath: "features/finance/transactions/pages/TransactionsPage",
        nav: { label: "Movimientos", iconKey: "PiggyBank", section: "Finanzas", order: 1 },
        permission: { action: "read", subject: "Transaction" },
        title: "Movimientos registrados",
      },
      {
        path: "statistics",
        componentPath: "features/finance/statistics/pages/FinanzasStatsPage",
        nav: { label: "Estadísticas", iconKey: "BarChart3", section: "Finanzas", order: 2 },
        permission: { action: "read", subject: "Transaction" },
        title: "Estadísticas financieras",
      },
      {
        path: "balances",
        componentPath: "features/finance/balances/pages/DailyBalancesPage",
        nav: { label: "Saldos Diarios", iconKey: "PiggyBank", section: "Finanzas", order: 3 },
        permission: { action: "read", subject: "DailyBalance" },
        title: "Saldos diarios",
      },
      {
        path: "counterparts",
        componentPath: "pages/Counterparts",
        nav: { label: "Contrapartes", iconKey: "Users2", section: "Finanzas", order: 4 },
        permission: { action: "read", subject: "Counterpart" },
        title: "Contrapartes",
      },
      {
        path: "participants",
        componentPath: "pages/ParticipantInsights",
        nav: { label: "Participantes", iconKey: "Users2", section: "Finanzas", order: 5 },
        permission: { action: "read", subject: "Person" },
        title: "Participantes",
      },
      {
        path: "production-balances",
        componentPath: "pages/finanzas/ProductionBalancesPage",
        nav: { label: "Balance Diario", iconKey: "FileSpreadsheet", section: "Finanzas", order: 6 },
        permission: { action: "read", subject: "ProductionBalance" },
        title: "Balances de producción diaria",
      },
      {
        path: "loans",
        componentPath: "features/finance/loans/pages/LoansPage",
        nav: { label: "Préstamos", iconKey: "PiggyBank", section: "Finanzas", order: 7 },
        permission: { action: "read", subject: "Loan" },
        title: "Préstamos y créditos",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SERVICES SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "services",
    componentPath: "features/services/layout/ServicesLayout",
    permission: { action: "read", subject: "Service" },
    title: "Servicios",
    children: [
      {
        index: true,
        componentPath: "features/services/pages/OverviewPage",
        nav: { label: "Servicios", iconKey: "Briefcase", section: "Servicios", order: 1 },
        permission: { action: "read", subject: "Service" },
        exact: true,
        title: "Servicios recurrentes",
      },
      {
        path: "agenda",
        componentPath: "features/services/pages/AgendaPage",
        nav: { label: "Agenda", iconKey: "CalendarDays", section: "Servicios", order: 2 },
        permission: { action: "read", subject: "Service" },
        title: "Agenda de servicios",
      },
      {
        path: "create",
        componentPath: "features/services/pages/CreateServicePage",
        permission: { action: "create", subject: "Service" },
        title: "Crear servicio",
      },
      {
        path: ":id/edit",
        componentPath: "features/services/pages/EditServicePage",
        permission: { action: "update", subject: "Service" },
        title: "Editar servicio",
      },
      {
        path: "templates",
        componentPath: "features/services/pages/TemplatesPage",
        title: "Plantillas de servicios",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OPERATIONS SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "operations",
    permission: { action: "read", subject: "InventoryItem" },
    title: "Operaciones",
    children: [
      { index: true, redirectTo: "/operations/inventory" },
      {
        path: "inventory",
        componentPath: "features/operations/inventory/pages/InventoryPage",
        nav: { label: "Inventario", iconKey: "Box", section: "Operaciones", order: 1 },
        permission: { action: "read", subject: "InventoryItem" },
        title: "Gestión de Inventario",
      },
      {
        path: "supplies",
        componentPath: "features/operations/supplies/pages/SuppliesPage",
        nav: { label: "Solicitudes", iconKey: "PackagePlus", section: "Operaciones", order: 2 },
        permission: { action: "read", subject: "SupplyRequest" },
        title: "Solicitud de Insumos",
      },
    ],
  },

  // HR routes
  {
    path: "hr",
    permission: { action: "read", subject: "Employee" },
    title: "RRHH",
    children: [
      { index: true, redirectTo: "/hr/employees" },
      {
        path: "employees",
        componentPath: "features/hr/employees/pages/EmployeesPage",
        nav: { label: "RRHH", iconKey: "Users2", section: "Operaciones", order: 3 },
        permission: { action: "read", subject: "Employee" },
        title: "Trabajadores",
      },
      {
        path: "timesheets",
        componentPath: "features/hr/timesheets/pages/TimesheetsPage",
        nav: { label: "Control Horas", iconKey: "Clock", section: "Operaciones", order: 4 },
        permission: { action: "read", subject: "Timesheet" },
        title: "Horas y pagos",
      },
      {
        path: "audit",
        componentPath: "features/hr/timesheets-audit/pages/TimesheetAuditPage",
        nav: { label: "Auditoría", iconKey: "ClipboardCheck", section: "Operaciones", order: 5 },
        permission: { action: "read", subject: "Timesheet" },
        title: "Auditoría de horarios",
      },
      {
        path: "reports",
        componentPath: "features/hr/reports/pages/ReportsPage",
        permission: { action: "read", subject: "Report" },
        title: "Reportes",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "settings",
    componentPath: "components/Layout/SettingsLayout",
    title: "Configuración",
    children: [
      { index: true, redirectTo: "/settings/roles" },
      {
        path: "roles",
        componentPath: "pages/settings/RolesSettingsPage",
        nav: { label: "Roles y Permisos", iconKey: "Users2", section: "Sistema", order: 1 },
        permission: { action: "read", subject: "Role" },
        title: "Roles y permisos",
      },
      {
        path: "users",
        componentPath: "features/users/pages/UserManagementPage",
        nav: { label: "Usuarios", iconKey: "UserCog", section: "Sistema", order: 2 },
        permission: { action: "read", subject: "User" },
        title: "Gestión de usuarios",
      },
      {
        path: "users/add",
        componentPath: "pages/admin/AddUserPage",
        permission: { action: "create", subject: "User" },
        title: "Agregar usuario",
      },
      {
        path: "people",
        componentPath: "features/users/pages/PersonManagementPage",
        nav: { label: "Personas", iconKey: "Users", section: "Sistema", order: 3 },
        permission: { action: "read", subject: "Person" },
        title: "Gestión de personas",
      },
      {
        path: "people/:id",
        componentPath: "pages/settings/PersonDetailsPage",
        permission: { action: "read", subject: "Person" },
        title: "Detalles de persona",
      },
      {
        path: "calendar",
        componentPath: "pages/settings/CalendarSettingsPage",
        nav: { label: "Cfg. Calendario", iconKey: "Calendar", section: "Sistema", order: 4 },
        permission: { action: "update", subject: "CalendarSetting" },
        title: "Accesos y conexiones",
      },
      {
        path: "inventario",
        componentPath: "pages/settings/InventorySettingsPage",
        nav: { label: "Cfg. Inventario", iconKey: "PackagePlus", section: "Sistema", order: 5 },
        permission: { action: "update", subject: "InventorySetting" },
        title: "Parámetros de inventario",
      },
      {
        path: "csv-upload",
        componentPath: "pages/settings/CSVUploadPage",
        nav: { label: "Carga masiva", iconKey: "Upload", section: "Sistema", order: 7 },
        permission: { action: "create", subject: "BulkData" },
        title: "Carga masiva de datos",
      },
      {
        path: "backups",
        componentPath: "pages/settings/BackupSettingsPage",
        nav: { label: "Backups", iconKey: "Database", section: "Sistema", order: 8 },
        permission: { action: "read", subject: "Backup" },
        title: "Backups de base de datos",
      },
      {
        path: "mercadopago",
        componentPath: "pages/settings/MercadoPagoSettingsPage",
        nav: { label: "Mercado Pago", iconKey: "CreditCard", section: "Sistema", order: 6 },
        permission: { action: "read", subject: "Integration" },
        title: "Reportes Mercado Pago",
      },
      {
        path: "access",
        componentPath: "pages/settings/AccessSettingsPage",
        nav: { label: "Control Acceso", iconKey: "ShieldCheck", section: "Sistema", order: 9 },
        permission: { action: "update", subject: "User" },
        title: "Control de acceso y MFA",
      },
    ],
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ACCOUNT PAGE (User's own account settings - no permission required)
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "account",
    componentPath: "pages/AccountSettingsPage",
    title: "Mi Cuenta",
    // No permission required - all authenticated users can access their own account
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ONBOARDING (new user setup wizard - no permission required)
  // ══════════════════════════════════════════════════════════════════════════
  {
    path: "onboarding",
    componentPath: "pages/onboarding/OnboardingWizard",
    title: "Configuración inicial",
    // No permission required - new users need to complete onboarding
  },
];

// ============================================================================
// SECTION ORDER (defines visual order in sidebar)
// ============================================================================

export const SECTION_ORDER: NavSection[] = ["Calendario", "Finanzas", "Servicios", "Operaciones", "Sistema"];

// ============================================================================
// API-ONLY PERMISSIONS (no UI page, used by API endpoints directly)
// ============================================================================

/**
 * Permissions for API endpoints that don't have a corresponding UI page.
 * These are synced to the database alongside route-derived permissions.
 */
export const API_PERMISSIONS: RoutePermission[] = [
  // Permission management endpoints (/api/roles/permissions)
  { action: "read", subject: "Permission" },
  { action: "update", subject: "Permission" },
];
