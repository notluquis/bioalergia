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

export interface RoutePermission {
  action: string;
  subject: string;
}
