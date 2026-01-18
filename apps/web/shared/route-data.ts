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

export interface NavConfig {
  /** Lucide icon name */
  iconKey: string;
  /** Label shown in sidebar */
  label: string;
  /** Sort order within section (lower = higher) */
  order: number;
  /** Section grouping in sidebar */
  section: NavSection;
}

export type NavSection = "Calendario" | "Finanzas" | "Operaciones" | "Servicios" | "Sistema";

export interface RouteData {
  /** Nested child routes */
  children?: RouteData[];

  /**
   * Component path for lazy loading (relative to src/)
   * Example: "pages/CalendarSchedulePage", "features/finance/transactions/pages/TransactionsPage"
   */
  componentPath?: string;

  /** If true, only match exact path (for index routes) */
  exact?: boolean;

  /** If true, this is an index route (renders at parent path) */
  index?: boolean;

  /**
   * Navigation config - if present, route appears in sidebar
   * If undefined, route exists but is not shown in navigation
   */
  nav?: NavConfig;

  /** URL path segment (relative to parent). Optional if index is true. */
  path?: string;

  /** Required permission to access this route */
  permission?: RoutePermission;

  /** Redirect to another path */
  redirectTo?: string;

  /** Route metadata (used for breadcrumbs, page title) */
  title?: string;
}

export interface RoutePermission {
  action: string;
  subject: string;
}

// ============================================================================
// ROUTE DATA (no component imports - safe for server)
// ============================================================================

export const ROUTE_DATA: RouteData[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // HOME / DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  {
    componentPath: "pages/Home",
    exact: true,
    nav: { iconKey: "Home", label: "Inicio", order: 0, section: "Calendario" },
    path: "",
    permission: { action: "read", subject: "Dashboard" },
    title: "Inicio",
  },
  // ══════════════════════════════════════════════════════════════════════════
  // CALENDAR SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    children: [
      { index: true, redirectTo: "/calendar/schedule" },
      {
        componentPath: "pages/CalendarSchedulePage",
        nav: { iconKey: "CalendarDays", label: "Calendario", order: 1, section: "Calendario" },
        path: "schedule",
        permission: { action: "read", subject: "CalendarSchedule" },
        title: "Calendario interactivo",
      },
      {
        componentPath: "pages/CalendarDailyPage",
        nav: { iconKey: "Calendar", label: "Detalle Diario", order: 2, section: "Calendario" },
        path: "daily",
        permission: { action: "read", subject: "CalendarDaily" },
        title: "Detalle diario",
      },
      {
        componentPath: "pages/CalendarHeatmapPage",
        nav: { iconKey: "LayoutDashboard", label: "Mapa de Calor", order: 3, section: "Calendario" },
        path: "heatmap",
        permission: { action: "read", subject: "CalendarHeatmap" },
        title: "Mapa de calor",
      },
      {
        componentPath: "pages/CalendarClassificationPage",
        nav: { iconKey: "ListChecks", label: "Clasificar", order: 4, section: "Calendario" },
        path: "classify",
        permission: { action: "update", subject: "CalendarEvent" },
        title: "Clasificar eventos",
      },
      {
        componentPath: "pages/CalendarSyncHistoryPage",
        nav: { iconKey: "Clock", label: "Historial Sync", order: 5, section: "Calendario" },
        path: "sync-history",
        permission: { action: "read", subject: "CalendarSyncLog" },
        title: "Historial de sincronización",
      },
    ],
    componentPath: "components/Layout/CalendarLayout",
    path: "calendar",
    title: "Calendario",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINANZAS SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    children: [
      { index: true, redirectTo: "/finanzas/conciliaciones" },
      {
        componentPath: "features/finance/settlements/pages/SettlementsPage",
        nav: { iconKey: "ListChecks", label: "Conciliaciones", order: 2, section: "Finanzas" },
        path: "conciliaciones",
        permission: { action: "read", subject: "Integration" },
        title: "Conciliaciones (MP)",
      },
      {
        componentPath: "features/finance/releases/pages/ReleasesPage",
        nav: { iconKey: "Wallet", label: "Liberaciones", order: 3, section: "Finanzas" },
        path: "liberaciones",
        permission: { action: "read", subject: "Integration" },
        title: "Liberaciones (MP)",
      },
      {
        componentPath: "features/finance/statistics/pages/FinanzasStatsPage",
        nav: { iconKey: "BarChart3", label: "Estadísticas", order: 2, section: "Finanzas" },
        path: "statistics",
        permission: { action: "read", subject: "TransactionStats" },
        title: "Estadísticas financieras",
      },
      // Removed 'balances' route as requested by user
      // {
      //   path: "balances",
      //   componentPath: "features/finance/balances/pages/DailyBalancesPage",
      //   nav: { label: "Saldos Diarios", iconKey: "PiggyBank", section: "Finanzas", order: 3 },
      //   permission: { action: "read", subject: "DailyBalance" },
      //   title: "Saldos diarios",
      // },
      {
        componentPath: "pages/Counterparts",
        nav: { iconKey: "Users2", label: "Contrapartes", order: 4, section: "Finanzas" },
        path: "counterparts",
        permission: { action: "read", subject: "Counterpart" },
        title: "Contrapartes",
      },
      {
        componentPath: "pages/ParticipantInsights",
        nav: { iconKey: "Users2", label: "Participantes", order: 5, section: "Finanzas" },
        path: "participants",
        permission: { action: "read", subject: "Person" },
        title: "Participantes",
      },
      {
        componentPath: "pages/finanzas/ProductionBalancesPage",
        nav: { iconKey: "FileSpreadsheet", label: "Balance Diario", order: 6, section: "Finanzas" },
        path: "production-balances",
        permission: { action: "read", subject: "ProductionBalance" },
        title: "Balances de producción diaria",
      },
      {
        componentPath: "features/finance/loans/pages/LoansPage",
        nav: { iconKey: "PiggyBank", label: "Préstamos", order: 7, section: "Finanzas" },
        path: "loans",
        permission: { action: "read", subject: "Loan" },
        title: "Préstamos y créditos",
      },
    ],
    path: "finanzas",
    title: "Finanzas",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SERVICES SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    children: [
      {
        componentPath: "features/services/pages/OverviewPage",
        exact: true,
        index: true,
        nav: { iconKey: "Briefcase", label: "Servicios", order: 1, section: "Servicios" },
        permission: { action: "read", subject: "ServiceList" },
        title: "Servicios recurrentes",
      },
      {
        componentPath: "features/services/pages/AgendaPage",
        nav: { iconKey: "CalendarDays", label: "Agenda", order: 2, section: "Servicios" },
        path: "agenda",
        permission: { action: "read", subject: "ServiceAgenda" },
        title: "Agenda de servicios",
      },
      {
        componentPath: "features/services/pages/CreateServicePage",
        path: "create",
        permission: { action: "create", subject: "Service" },
        title: "Crear servicio",
      },
      {
        componentPath: "features/services/pages/EditServicePage",
        path: ":id/edit",
        permission: { action: "update", subject: "Service" },
        title: "Editar servicio",
      },
      {
        componentPath: "features/services/pages/TemplatesPage",
        path: "templates",
        permission: { action: "read", subject: "ServiceTemplate" },
        title: "Plantillas de servicios",
      },
    ],
    componentPath: "features/services/layout/ServicesLayout",
    path: "services",
    title: "Servicios",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OPERATIONS SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    children: [
      { index: true, redirectTo: "/operations/inventory" },
      {
        componentPath: "features/operations/inventory/pages/InventoryPage",
        nav: { iconKey: "Box", label: "Inventario", order: 1, section: "Operaciones" },
        path: "inventory",
        permission: { action: "read", subject: "InventoryItem" },
        title: "Gestión de Inventario",
      },
      {
        componentPath: "features/operations/supplies/pages/SuppliesPage",
        nav: { iconKey: "PackagePlus", label: "Solicitudes", order: 2, section: "Operaciones" },
        path: "supplies",
        permission: { action: "read", subject: "SupplyRequest" },
        title: "Solicitud de Insumos",
      },
    ],
    path: "operations",
    title: "Operaciones",
  },

  // HR routes
  {
    children: [
      { index: true, redirectTo: "/hr/employees" },
      {
        componentPath: "features/hr/employees/pages/EmployeesPage",
        nav: { iconKey: "Users2", label: "RRHH", order: 3, section: "Operaciones" },
        path: "employees",
        permission: { action: "read", subject: "Employee" },
        title: "Trabajadores",
      },
      {
        componentPath: "features/hr/timesheets/pages/TimesheetsPage",
        nav: { iconKey: "Clock", label: "Control Horas", order: 4, section: "Operaciones" },
        path: "timesheets",
        permission: { action: "read", subject: "TimesheetList" },
        title: "Horas y pagos",
      },
      {
        componentPath: "features/hr/timesheets-audit/pages/TimesheetAuditPage",
        nav: { iconKey: "ClipboardCheck", label: "Auditoría", order: 5, section: "Operaciones" },
        path: "audit",
        permission: { action: "read", subject: "TimesheetAudit" },
        title: "Auditoría de horarios",
      },
      {
        componentPath: "features/hr/reports/pages/ReportsPage",
        nav: { iconKey: "BarChart3", label: "Análisis", order: 6, section: "Operaciones" },
        path: "reports",
        permission: { action: "read", subject: "Report" },
        title: "Reportes y estadísticas",
      },
    ],
    path: "hr",
    title: "RRHH",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS SECTION
  // ══════════════════════════════════════════════════════════════════════════
  {
    children: [
      { index: true, redirectTo: "/settings/roles" },
      {
        componentPath: "pages/settings/RolesSettingsPage",
        nav: { iconKey: "Users2", label: "Roles y Permisos", order: 1, section: "Sistema" },
        path: "roles",
        permission: { action: "read", subject: "Role" },
        title: "Roles y permisos",
      },
      {
        componentPath: "features/users/pages/UserManagementPage",
        nav: { iconKey: "UserCog", label: "Usuarios", order: 2, section: "Sistema" },
        path: "users",
        permission: { action: "read", subject: "User" },
        title: "Gestión de usuarios",
      },
      {
        componentPath: "pages/admin/AddUserPage",
        path: "users/add",
        permission: { action: "create", subject: "User" },
        title: "Agregar usuario",
      },
      {
        componentPath: "features/users/pages/PersonManagementPage",
        nav: { iconKey: "Users", label: "Personas", order: 3, section: "Sistema" },
        path: "people",
        permission: { action: "read", subject: "Person" },
        title: "Gestión de personas",
      },
      {
        componentPath: "pages/settings/PersonDetailsPage",
        path: "people/:id",
        permission: { action: "read", subject: "Person" },
        title: "Detalles de persona",
      },
      {
        componentPath: "pages/settings/CalendarSettingsPage",
        nav: { iconKey: "Calendar", label: "Cfg. Calendario", order: 4, section: "Sistema" },
        path: "calendar",
        permission: { action: "update", subject: "CalendarSetting" },
        title: "Accesos y conexiones",
      },
      {
        componentPath: "pages/settings/InventorySettingsPage",
        nav: { iconKey: "PackagePlus", label: "Cfg. Inventario", order: 5, section: "Sistema" },
        path: "inventario",
        permission: { action: "update", subject: "InventorySetting" },
        title: "Parámetros de inventario",
      },
      {
        componentPath: "pages/settings/CSVUploadPage",
        nav: { iconKey: "Upload", label: "Carga masiva", order: 7, section: "Sistema" },
        path: "csv-upload",
        permission: { action: "create", subject: "BulkData" },
        title: "Carga masiva de datos",
      },
      {
        componentPath: "pages/settings/BackupSettingsPage",
        nav: { iconKey: "Database", label: "Backups", order: 8, section: "Sistema" },
        path: "backups",
        permission: { action: "read", subject: "Backup" },
        title: "Backups de base de datos",
      },
      {
        componentPath: "pages/settings/MercadoPagoSettingsPage",
        nav: { iconKey: "CreditCard", label: "Mercado Pago", order: 6, section: "Sistema" },
        path: "mercadopago",
        permission: { action: "read", subject: "Integration" },
        title: "Reportes Mercado Pago",
      },
      {
        componentPath: "pages/settings/AccessSettingsPage",
        nav: { iconKey: "ShieldCheck", label: "Control Acceso", order: 9, section: "Sistema" },
        path: "access",
        permission: { action: "update", subject: "User" },
        title: "Control de acceso y MFA",
      },
      {
        componentPath: "pages/admin/SyncHistoryPage",
        nav: { iconKey: "History", label: "Historial Sync", order: 10, section: "Sistema" },
        path: "sync-history",
        permission: { action: "read", subject: "SyncLog" },
        title: "Historial de Sincronización",
      },
    ],
    componentPath: "components/Layout/SettingsLayout",
    path: "settings",
    title: "Configuración",
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ACCOUNT PAGE (User's own account settings - no permission required)
  // ══════════════════════════════════════════════════════════════════════════
  {
    componentPath: "pages/AccountSettingsPage",
    path: "account",
    title: "Mi Cuenta",
    // No permission required - all authenticated users can access their own account
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ONBOARDING (new user setup wizard - no permission required)
  // ══════════════════════════════════════════════════════════════════════════
  {
    componentPath: "pages/onboarding/OnboardingWizard",
    path: "onboarding",
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
