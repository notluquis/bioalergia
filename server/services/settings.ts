import { prisma } from "../prisma.js";
import { type AppSettings, DEFAULT_SETTINGS, settingsKeyToDbKey, dbKeyToSettingsKey } from "../lib/settings.js";

export async function loadSettings(): Promise<AppSettings> {
  const settings = await prisma.setting.findMany();
  const result: AppSettings = { ...DEFAULT_SETTINGS };

  for (const setting of settings) {
    const appKey = dbKeyToSettingsKey(setting.configKey);
    if (appKey) {
      result[appKey] = setting.configValue || "";
    }
  }

  return result;
}

export async function saveSettings(settings: AppSettings) {
  const promises = (Object.keys(settings) as Array<keyof AppSettings>).map((key) =>
    prisma.setting.upsert({
      where: { configKey: settingsKeyToDbKey(key) },
      update: { configValue: settings[key] },
      create: { configKey: settingsKeyToDbKey(key), configValue: settings[key] },
    })
  );
  await Promise.all(promises);
}

export async function getInternalConfig(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({
    where: { configKey: key },
  });
  return setting?.configValue ?? null;
}

export async function setInternalConfig(key: string, value: string | null) {
  if (value === null) {
    await prisma.setting.delete({
      where: { configKey: key },
    });
  } else {
    await prisma.setting.upsert({
      where: { configKey: key },
      update: { configValue: value },
      create: { configKey: key, configValue: value },
    });
  }
}
