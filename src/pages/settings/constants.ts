import { Settings as SettingsIcon, Calendar, Shield, ServerCog, Boxes, FileSpreadsheet } from "lucide-react";

export const SETTINGS_PAGES = [
  {
    to: "general",
    label: "Identidad y marca",
    description: "Colores, logo y metadatos públicos.",
    icon: SettingsIcon,
  },
  {
    to: "calendar",
    label: "Calendario",
    description: "Ventanas de sincronización y exclusiones.",
    icon: Calendar,
  },
  {
    to: "accesos",
    label: "Accesos y conexiones",
    description: "URLs de cPanel, base de datos y credenciales visibles.",
    icon: ServerCog,
  },
  {
    to: "inventario",
    label: "Inventario",
    description: "Categorías y organización del inventario.",
    icon: Boxes,
  },
  {
    to: "roles",
    label: "Roles y permisos",
    description: "Mapeo entre roles operativos y la app.",
    icon: Shield,
  },
  {
    to: "balances-diarios",
    label: "Balance diario de prestaciones",
    description: "Ingresos diarios en CLP con historial de cambios.",
    icon: FileSpreadsheet,
  },
] as const;
