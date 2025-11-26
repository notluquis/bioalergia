import { KeyRound, Calendar, Shield, Boxes } from "lucide-react";

export const SETTINGS_PAGES = [
  {
    to: "calendar",
    label: "Calendario",
    description: "Ventanas de sincronización y exclusiones.",
    icon: Calendar,
  },
  {
    to: "security",
    label: "Seguridad",
    icon: Shield,
    description: "Configura MFA y Passkeys",
  },
  {
    to: "access",
    label: "Accesos",
    icon: KeyRound,
    description: "Accesos rápidos y configuración de DB",
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
] as const;
