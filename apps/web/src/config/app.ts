export const APP_CONFIG = {
  companyLegalName: "Bioalergia SpA",
  // Default System Settings
  defaults: {
    calendarDailyMaxDays: "31",
    calendarExcludeSummaries: "No Disponible",
    calendarSyncLookaheadDays: "365",
    calendarSyncStart: "2000-01-01",
    // Calendar Defaults
    calendarTimeZone: "America/Santiago",

    cpanelUrl: "",
    dbConsoleUrl: "",
    // Database Defaults
    dbDisplayHost: "localhost",
    dbDisplayName: "finanzas",

    faviconUrl: "/logo_bimi.svg",
    logoUrl: "",
    pageTitle: "Bioalergia",

    primaryColor: "oklch(var(--p))",
    // Build Defaults
    primaryCurrency: "CLP",
    secondaryColor: "oklch(var(--s))",
    supportEmail: "contacto@bioalergia.cl",
    tagline: "Suite de administración",
  },
  name: "Bioalergia",

  version: "1.0.0",
} as const;

export type AppConfig = typeof APP_CONFIG;
