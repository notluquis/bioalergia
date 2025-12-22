export type NavCategory = "Resumen" | "Finanzas" | "Gestión" | "Servicios" | "Calendario";

export type NavItemData = {
  to: string;
  label: string;
  iconKey: string; // Serialized icon name
  roles?: string[];
  requiredPermission?: { action: string; subject: string };
  exact?: boolean;
  subItems?: NavItemData[];
};

export type NavSectionData = {
  title: string;
  category: NavCategory;
  items: NavItemData[];
};

export const NAV_DATA: NavSectionData[] = [
  {
    title: "Resumen",
    category: "Resumen",
    items: [
      {
        to: "/",
        label: "Panel",
        iconKey: "LayoutDashboard",
        exact: true,
        requiredPermission: { action: "read", subject: "Dashboard" },
      },
      {
        to: "/reports",
        label: "Reportes",
        iconKey: "FileBarChart",
        requiredPermission: { action: "read", subject: "Report" },
      },
    ],
  },
  {
    title: "Finanzas",
    category: "Finanzas",
    items: [
      {
        to: "/finanzas/movements",
        label: "Movimientos",
        iconKey: "PiggyBank",
        requiredPermission: { action: "read", subject: "Transaction" },
      },
      {
        to: "/finanzas/balances",
        label: "Saldos Diarios",
        iconKey: "PiggyBank",
        requiredPermission: { action: "read", subject: "DailyBalance" },
      },
      {
        to: "/finanzas/counterparts",
        label: "Contrapartes",
        iconKey: "Users2",
        requiredPermission: { action: "read", subject: "Counterpart" },
      },
      {
        to: "/finanzas/participants",
        label: "Participantes",
        iconKey: "Users2",
        requiredPermission: { action: "read", subject: "Person" },
      },
      {
        to: "/finanzas/production-balances",
        label: "Balance Diario",
        iconKey: "FileSpreadsheet",
        requiredPermission: { action: "read", subject: "ProductionBalance" },
      },
      {
        to: "/finanzas/loans",
        label: "Préstamos",
        iconKey: "PiggyBank",
        requiredPermission: { action: "read", subject: "Loan" },
      },
    ],
  },
  {
    title: "Servicios",
    category: "Servicios",
    items: [
      {
        to: "/services",
        label: "Servicios",
        iconKey: "Briefcase",
        exact: true,
        requiredPermission: { action: "read", subject: "Service" },
      },
      {
        to: "/services/agenda",
        label: "Agenda",
        iconKey: "CalendarDays",
        requiredPermission: { action: "read", subject: "Service" },
      },
    ],
  },
  {
    title: "Calendario",
    category: "Calendario",
    items: [
      {
        to: "/calendar/summary",
        label: "Calendario",
        iconKey: "CalendarDays",
        requiredPermission: { action: "read", subject: "CalendarEvent" },
      },
      {
        to: "/calendar/classify",
        label: "Clasificar",
        iconKey: "ListChecks",
        requiredPermission: { action: "update", subject: "CalendarEvent" },
      },
    ],
  },
  {
    title: "Operaciones",
    category: "Gestión",
    items: [
      {
        to: "/operations/inventory",
        label: "Inventario",
        iconKey: "Box",
        requiredPermission: { action: "read", subject: "InventoryItem" },
      },
      {
        to: "/operations/supplies",
        label: "Solicitudes",
        iconKey: "PackagePlus",
        requiredPermission: { action: "read", subject: "SupplyRequest" },
      },
      {
        to: "/hr/employees",
        label: "RRHH",
        iconKey: "Users2",
        requiredPermission: { action: "read", subject: "Employee" },
      },
      {
        to: "/hr/timesheets",
        label: "Control Horas",
        iconKey: "Clock",
        requiredPermission: { action: "read", subject: "Timesheet" },
      },
      {
        to: "/hr/audit",
        label: "Auditoría",
        iconKey: "ClipboardCheck",
        requiredPermission: { action: "read", subject: "Timesheet" },
      },
    ],
  },
  {
    title: "Sistema",
    category: "Gestión",
    items: [
      {
        to: "/settings/roles",
        label: "Roles y Permisos",
        iconKey: "Users2",
        requiredPermission: { action: "read", subject: "Role" },
      },
      {
        to: "/settings/users",
        label: "Usuarios",
        iconKey: "UserCog",
        requiredPermission: { action: "read", subject: "User" },
      },
      {
        to: "/settings/people",
        label: "Personas",
        iconKey: "Users",
        requiredPermission: { action: "read", subject: "Person" },
      },
      {
        to: "/settings/calendar",
        label: "Cfg. Calendario",
        iconKey: "Calendar",
        requiredPermission: { action: "update", subject: "CalendarEvent" },
      },
      {
        to: "/settings/inventario",
        label: "Cfg. Inventario",
        iconKey: "PackagePlus",
        requiredPermission: { action: "update", subject: "InventoryItem" },
      },
      {
        to: "/settings/security",
        label: "Seguridad",
        iconKey: "Settings2",
        requiredPermission: { action: "update", subject: "Setting" },
      },
      {
        to: "/settings/csv-upload",
        label: "Carga masiva",
        iconKey: "Upload",
        roles: ["admin", "hr_manager"],
        requiredPermission: { action: "create", subject: "BulkData" },
      },
    ],
  },
];
