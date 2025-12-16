export const APP_CONFIG = {
  name: "Bioalergia",
  companyLegalName: "Bioalergia SpA",
  version: "1.0.0",

  // Default System Settings
  defaults: {
    tagline: "Suite de administración",
    primaryColor: "oklch(var(--p))",
    secondaryColor: "oklch(var(--s))",
    logoUrl: "",
    faviconUrl: "/logo_bimi.svg",

    // Database Defaults
    dbDisplayHost: "localhost",
    dbDisplayName: "finanzas",
    dbConsoleUrl: "",
    cpanelUrl: "",

    // Build Defaults
    primaryCurrency: "CLP",
    supportEmail: "soporte@bioalergia.cl",
    pageTitle: "Bioalergia Suite",

    // Calendar Defaults
    calendarTimeZone: "America/Santiago",
    calendarSyncStart: "2000-01-01",
    calendarSyncLookaheadDays: "365",
    calendarExcludeSummaries: "No Disponible",
    calendarDailyMaxDays: "31",
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
