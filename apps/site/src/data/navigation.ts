// Single source of truth for primary site navigation.
// Used by SiteHeader (top nav), App.tsx (home header) and SiteFooter.
// Anchor links use absolute `/#id` so they resolve from any route.

export type NavLink = {
  label: string;
  href: string;
  /** Highlight in accent color (storefront / account). */
  accent?: boolean;
};

export const primaryNav: NavLink[] = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Exámenes", href: "/examenes" },
  { label: "Inmunoterapia", href: "/inmunoterapia" },
  { label: "Botiquín", href: "/botiquin" },
  { label: "Polen", href: "/polen" },
  { label: "Aprende", href: "/aprende" },
  { label: "Noticias", href: "/noticias" },
  { label: "Equipo", href: "/equipo" },
  { label: "Contacto", href: "/#contacto" },
  { label: "Tienda", href: "/tienda", accent: true },
  { label: "Mi cuenta", href: "/mi-cuenta", accent: true },
];

// Secondary links surfaced in the footer (not in the top nav).
export const secondaryNav: NavLink[] = [
  { label: "Buscar", href: "/buscar" },
  { label: "¿Eres alérgico?", href: "/eres-alergico" },
  { label: "Preguntas frecuentes", href: "/#faq" },
  { label: "Compromiso social", href: "/compromiso-social" },
];
