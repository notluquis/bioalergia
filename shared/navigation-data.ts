export type NavCategory = "Resumen" | "Finanzas" | "Gestión" | "Servicios" | "Calendario";

export type NavItemData = {
  to: string;
  label: string;
  iconKey: string; // Serialized icon name
  roles?: string[];
  requiredPermission?: { action: string; subject: string };
  exact?: boolean;
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
    items: [{ to: "/", label: "Panel", iconKey: "LayoutDashboard", exact: true }],
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
        to: "/hr/employees",
        label: "RRHH",
        iconKey: "Users2",
        requiredPermission: { action: "read", subject: "Employee" },
      },
    ],
  },
  {
    title: "Cuenta",
    category: "Gestión",
    items: [
      {
        to: "/settings/security",
        label: "Seguridad",
        iconKey: "Settings",
      },
    ],
  },
];
