import { db } from "@finanzas/db";

import { deleteSetting, getSetting, updateSetting } from "./settings.ts";

const DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY = "doctoralia:scraper:force_next_run";
const DEFAULT_FORCE_RUN_TTL_MINUTES = 120;

type ForceRunPayload = {
  expiresAt: string;
  requestedAt: string;
  requestedByUserId: null | number;
};

export type DoctoraliaScraperForceRunStatus = {
  active: boolean;
  expiresAt: null | string;
  requestedAt: null | string;
  requestedByEmail: null | string;
  requestedByUserId: null | number;
};

export type DoctoraliaScraperForceRunConsumeResult = {
  active: boolean;
  expiresAt: null | string;
  requestedAt: null | string;
  source: "db" | "none";
};

function parsePayload(raw: null | string): ForceRunPayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ForceRunPayload>;
    if (
      typeof parsed.requestedAt !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      (parsed.requestedByUserId !== null &&
        parsed.requestedByUserId !== undefined &&
        typeof parsed.requestedByUserId !== "number")
    ) {
      return null;
    }

    return {
      expiresAt: parsed.expiresAt,
      requestedAt: parsed.requestedAt,
      requestedByUserId: parsed.requestedByUserId ?? null,
    };
  } catch {
    return null;
  }
}

function isActive(payload: ForceRunPayload): boolean {
  const expiresAt = Date.parse(payload.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function resolveRequestedByEmail(userId: null | number): Promise<null | string> {
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      loginEmail: true,
      person: {
        select: { email: true },
      },
    },
  });

  return user?.loginEmail ?? user?.person?.email ?? null;
}

export async function getDoctoraliaScraperForceRunStatus(): Promise<DoctoraliaScraperForceRunStatus> {
  const payload = parsePayload(await getSetting(DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY));
  if (!payload) {
    return {
      active: false,
      expiresAt: null,
      requestedAt: null,
      requestedByEmail: null,
      requestedByUserId: null,
    };
  }

  if (!isActive(payload)) {
    await deleteSetting(DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY).catch(() => undefined);
    return {
      active: false,
      expiresAt: null,
      requestedAt: payload.requestedAt,
      requestedByEmail: await resolveRequestedByEmail(payload.requestedByUserId),
      requestedByUserId: payload.requestedByUserId,
    };
  }

  return {
    active: true,
    expiresAt: payload.expiresAt,
    requestedAt: payload.requestedAt,
    requestedByEmail: await resolveRequestedByEmail(payload.requestedByUserId),
    requestedByUserId: payload.requestedByUserId,
  };
}

export async function requestDoctoraliaScraperForceRun(params: {
  requestedByUserId: number;
  ttlMinutes?: number;
}): Promise<DoctoraliaScraperForceRunStatus> {
  const now = new Date();
  const ttlMinutes =
    params.ttlMinutes && Number.isFinite(params.ttlMinutes) && params.ttlMinutes > 0
      ? Math.floor(params.ttlMinutes)
      : DEFAULT_FORCE_RUN_TTL_MINUTES;
  const payload: ForceRunPayload = {
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    requestedAt: now.toISOString(),
    requestedByUserId: params.requestedByUserId,
  };

  await updateSetting(DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY, JSON.stringify(payload));
  return getDoctoraliaScraperForceRunStatus();
}

export async function clearDoctoraliaScraperForceRun(): Promise<DoctoraliaScraperForceRunStatus> {
  await deleteSetting(DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY).catch(() => undefined);
  return {
    active: false,
    expiresAt: null,
    requestedAt: null,
    requestedByEmail: null,
    requestedByUserId: null,
  };
}

export async function consumeDoctoraliaScraperForceRun(): Promise<DoctoraliaScraperForceRunConsumeResult> {
  const result = await db.$transaction(async () => {
    const setting = await db.setting.findUnique({
      where: { key: DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY },
      select: { value: true },
    });
    const payload = parsePayload(setting?.value ?? null);
    if (!payload) {
      if (setting) {
        await db.setting.delete({ where: { key: DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY } });
      }
      return null;
    }

    if (!isActive(payload)) {
      await db.setting.delete({ where: { key: DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY } });
      return { payload, active: false };
    }

    await db.setting.delete({ where: { key: DOCTORALIA_SCRAPER_FORCE_NEXT_RUN_KEY } });
    return { payload, active: true };
  });

  if (!result) {
    return { active: false, expiresAt: null, requestedAt: null, source: "none" };
  }

  if (!result.active) {
    return {
      active: false,
      expiresAt: result.payload.expiresAt,
      requestedAt: result.payload.requestedAt,
      source: "none",
    };
  }

  return {
    active: true,
    expiresAt: result.payload.expiresAt,
    requestedAt: result.payload.requestedAt,
    source: "db",
  };
}
