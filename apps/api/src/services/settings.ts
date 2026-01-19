import { db } from "@finanzas/db";
import { type AppSettings, DEFAULT_SETTINGS, dbKeyToSettingsKey } from "../lib/settings";

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

export async function getSettings() {
  const settings = await db.setting.findMany();
  return settings.reduce(
    (acc, curr) => {
      acc[curr.key] = curr.value ?? "";
      return acc;
    },
    {} as Record<string, string>,
  );
}

export async function getSetting(key: string) {
  const setting = await db.setting.findUnique({
    where: { key },
  });
  return setting?.value ?? null;
}

export async function updateSetting(key: string, value: string) {
  return await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function deleteSetting(key: string) {
  return await db.setting.delete({
    where: { key },
  });
}

export async function updateSettings(settings: Record<string, string>) {
  const updates = Object.entries(settings).map(([key, value]) =>
    db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    }),
  );
  return await db.$transaction(updates);
}
