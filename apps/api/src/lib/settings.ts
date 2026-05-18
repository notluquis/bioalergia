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
  whatsappFreeformMessage: string;
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
  whatsappFreeformMessage: "",
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
  whatsappFreeformMessage: "whatsapp.freeformMessage",
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

// ─── DB-backed accessors ──────────────────────────────────────────────────────
// Moved from services/settings.ts so lib/ files (notably
// lib/google/google-calendar.ts) can read settings without an upward edge
// into services/. lib/ is the lowest tier in the DAG and may touch the DB.
import { db } from "@finanzas/db";

export async function loadSettings(): Promise<AppSettings> {
  const settings = await db.setting.findMany();
  const result: AppSettings = { ...DEFAULT_SETTINGS };

  for (const setting of settings) {
    const appKey = dbKeyToSettingsKey(setting.key);
    if (appKey) {
      result[appKey] = setting.value || "";
    }
  }

  return result;
}

export async function getSettings(): Promise<Record<string, string>> {
  const settings = await db.setting.findMany();
  return settings.reduce(
    (acc, curr) => {
      acc[curr.key] = curr.value ?? "";
      return acc;
    },
    {} as Record<string, string>
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.setting.findUnique({
    where: { key },
  });
  return setting?.value ?? null;
}

export async function updateSetting(
  key: string,
  value: string
): Promise<Awaited<ReturnType<typeof db.setting.upsert>>> {
  return await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function deleteSetting(
  key: string
): Promise<Awaited<ReturnType<typeof db.setting.delete>>> {
  return await db.setting.delete({
    where: { key },
  });
}

export async function updateSettings(
  settings: Record<string, string>
): Promise<Awaited<ReturnType<typeof db.setting.upsert>>[]> {
  const updates = Object.entries(settings).map(([key, value]) =>
    db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  );
  return await db.$transaction(updates);
}
