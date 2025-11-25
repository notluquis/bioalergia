import { prisma } from "../prisma.js";
import { type AppSettings, DEFAULT_SETTINGS, settingsKeyToDbKey, dbKeyToSettingsKey } from "../lib/settings.js";

export async function loadSettings(): Promise<AppSettings> {
  const settings = await prisma.setting.findMany();
  const result: AppSettings = { ...DEFAULT_SETTINGS };

  for (const setting of settings) {
    const appKey = dbKeyToSettingsKey(setting.key);
    if (appKey) {
      result[appKey] = setting.value || "";
    }
  }

  return result;
}

export async function saveSettings(settings: AppSettings) {
  const promises = (Object.keys(settings) as Array<keyof AppSettings>).map((key) =>
    prisma.setting.upsert({
      where: { key: settingsKeyToDbKey(key) },
      update: { value: settings[key] },
      create: { key: settingsKeyToDbKey(key), value: settings[key] },
    })
  );
  await Promise.all(promises);
}

export async function getInternalConfig(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({
    where: { key: key },
  });
  return setting?.value ?? null;
}

export async function setInternalConfig(key: string, value: string | null) {
  if (value === null) {
    await prisma.setting.delete({
      where: { key: key },
    });
  } else {
    await prisma.setting.upsert({
      where: { key: key },
      update: { value: value },
      create: { key: key, value: value },
    });
  }
}
