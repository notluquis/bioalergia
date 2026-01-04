export type AppSettings = {
  orgName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  dbDisplayHost: string;
  dbDisplayName: string;
  dbConsoleUrl: string;
  cpanelUrl: string;
  orgAddress: string;
  orgPhone: string;
  primaryCurrency: string;
  supportEmail: string;
  pageTitle: string;
  calendarTimeZone: string;
  calendarSyncStart: string;
  calendarSyncLookaheadDays: string;
  calendarExcludeSummaries: string;
  calendarDailyMaxDays: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: "Bioalergia",
  tagline: "Gestión integral de finanzas",
  primaryColor: "#0e64b7",
  secondaryColor: "#f1a722",
  logoUrl: "",
  faviconUrl: "/logo_bimi.svg",
  dbDisplayHost: "localhost",
  dbDisplayName: "finanzas",
  dbConsoleUrl: "",
  cpanelUrl: "",
  orgAddress: "",
  orgPhone: "",
  primaryCurrency: "CLP",
  supportEmail: "soporte@bioalergia.cl",
  pageTitle: "Bioalergia · Finanzas",
  calendarTimeZone: "America/Santiago",
  calendarSyncStart: "2000-01-01",
  calendarSyncLookaheadDays: "365",
  calendarExcludeSummaries: "No Disponible",
  calendarDailyMaxDays: "31",
};

const SETTINGS_KEY_MAP: Record<keyof AppSettings, string> = {
  orgName: "brand.orgName",
  tagline: "brand.tagline",
  primaryColor: "brand.primaryColor",
  secondaryColor: "brand.secondaryColor",
  logoUrl: "brand.logoUrl",
  faviconUrl: "brand.faviconUrl",
  dbDisplayHost: "db.displayHost",
  dbDisplayName: "db.displayName",
  dbConsoleUrl: "db.consoleUrl",
  cpanelUrl: "db.cpanelUrl",
  orgAddress: "org.address",
  orgPhone: "org.phone",
  primaryCurrency: "org.primaryCurrency",
  supportEmail: "org.supportEmail",
  pageTitle: "page.title",
  calendarTimeZone: "calendar.timeZone",
  calendarSyncStart: "calendar.syncStart",
  calendarSyncLookaheadDays: "calendar.syncLookaheadDays",
  calendarExcludeSummaries: "calendar.excludeSummaries",
  calendarDailyMaxDays: "calendar.dailyMaxDays",
};

export function settingsKeyToDbKey(key: keyof AppSettings): string {
  return SETTINGS_KEY_MAP[key];
}

export function dbKeyToSettingsKey(dbKey: string): keyof AppSettings | null {
  for (const [appKey, mappedDbKey] of Object.entries(SETTINGS_KEY_MAP)) {
    if (mappedDbKey === dbKey) {
      return appKey as keyof AppSettings;
    }
  }
  return null;
}
