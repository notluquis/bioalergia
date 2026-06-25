// Single source of truth for primary site navigation.
// Used by SiteHeader (top nav), App.tsx (home header) and SiteFooter.
// Anchor links use absolute `/#id` so they resolve from any route.

export type NavLink = {
  label: string;
  href: string;
  /** Highlight in accent color (storefront / account). */
  accent?: boolean;
};

/** Header nav node — a leaf link or a group with a hover/focus dropdown. */
export type NavNode = {
  label: string;
  href?: string;
  children?: NavLink[];
};

/**
 * Compact header nav (the visible top strip). Groups secondary destinations
 * under "Sobre nosotros" and "Recursos" dropdowns so the bar stays short.
 * Tienda + Mi cuenta live in the header actions / utility bar, not here.
 */
export const headerNav: NavNode[] = [
  { label: "Inicio", href: "/" },
  {
    label: "Sobre nosotros",
    children: [
      { label: "Equipo", href: "/equipo" },
      { label: "Compromiso social", href: "/compromiso-social" },
      { label: "Contacto", href: "/contacto" },
    ],
  },
  { label: "Servicios", href: "/servicios" },
  { label: "Exámenes", href: "/examenes" },
  { label: "Inmunoterapia", href: "/inmunoterapia" },
  {
    label: "Recursos",
    children: [
      { label: "Botiquín", href: "/botiquin" },
      { label: "Polen", href: "/polen" },
      { label: "Aprende", href: "/aprende" },
      { label: "Noticias", href: "/noticias" },
    ],
  },
  { label: "Venta empresas", href: "/venta-empresas" },
];

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
  { label: "Venta empresas", href: "/venta-empresas" },
  { label: "Contacto", href: "/contacto" },
  { label: "Tienda", href: "/tienda", accent: true },
  { label: "Mi cuenta", href: "/mi-cuenta", accent: true },
];

// Secondary links surfaced in the footer (not in the top nav).
export const secondaryNav: NavLink[] = [
  { label: "Buscar", href: "/buscar" },
  { label: "Condiciones", href: "/condiciones" },
  { label: "¿Eres alérgico?", href: "/eres-alergico" },
  { label: "Preguntas frecuentes", href: "/#faq" },
  { label: "Salud ocupacional", href: "/salud-ocupacional" },
  { label: "Compromiso social", href: "/compromiso-social" },
  { label: "Precios", href: "/precios" },
  { label: "Derechos y deberes", href: "/derechos-deberes" },
  { label: "Reclamos", href: "/reclamos" },
  { label: "Ejercicio de derechos", href: "/derechos" },
  { label: "Canal de denuncias", href: "/denuncias" },
];
