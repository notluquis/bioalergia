// Job Radar — sincroniza ofertas de empleo (Teamtailor multi-empresa) y notifica
// vía Telegram solo las NUEVAS que matchean el perfil. Toda la lógica/DB vive
// acá (handler/cron fino → llama un servicio), ver [project_architecture_golden_2026].
//
// Idempotente: upsert por (source, company, externalId). Las que dejan de
// aparecer en el sitemap se marcan CLOSED. Se notifica una sola vez por job
// (flag `notified`).

import { db, type JsonValue } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";
import { logEvent, logWarn } from "../lib/logger.ts";
import { getSettings, updateSettings } from "../lib/settings.ts";
import { fetchBciJobs } from "../modules/job-radar/bci.ts";
import {
  DEFAULT_KEYWORDS,
  matchesProfile,
  type ProfileFilter,
} from "../modules/job-radar/filter.ts";
import { fetchGetonbrdJobs } from "../modules/job-radar/getonbrd.ts";
import { fetchGreenhouseJobs } from "../modules/job-radar/greenhouse.ts";
import { fetchLeverJobs } from "../modules/job-radar/lever.ts";
import { fetchTeamtailorJobs } from "../modules/job-radar/teamtailor.ts";
import {
  sendTelegramMessage,
  telegramConfigured,
  type TelegramCreds,
} from "../modules/job-radar/telegram.ts";
import type { RawJob } from "../modules/job-radar/types.ts";

// ── Configuración (DB-backed, fallback env, fallback default) ─────────────────
// Toda la config vive en la tabla `settings` (keys `jobRadar.*`), editable desde
// el dashboard. Se lee fresca en cada sync → cambios sin reiniciar (salvo el cron
// schedule, que se registra al boot en queue/runner.ts).

export const JOB_RADAR_DEFAULT_CRON = "*/30 * * * *";

const KEYS = {
  enabled: "jobRadar.enabled",
  companies: "jobRadar.companies",
  bci: "jobRadar.bci",
  getonbrd: "jobRadar.getonbrd",
  greenhouse: "jobRadar.greenhouse",
  lever: "jobRadar.lever",
  keywords: "jobRadar.keywords",
  departments: "jobRadar.departments",
  cron: "jobRadar.cron",
  telegramBotToken: "jobRadar.telegramBotToken",
  telegramChatId: "jobRadar.telegramChatId",
} as const;

export interface JobRadarConfig {
  enabled: boolean;
  companies: string[];
  bci: boolean;
  getonbrd: boolean;
  greenhouse: string[];
  lever: string[];
  keywords: string[];
  departments: string[];
  cron: string;
  telegram: TelegramCreds;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

// rec[key] si existe (incluso ""), si no → env, si no → default.
function pick(
  rec: Record<string, string>,
  key: string,
  env: string | undefined
): string | undefined {
  if (key in rec) return rec[key];
  return env;
}

export async function getJobRadarConfig(): Promise<JobRadarConfig> {
  const rec = await getSettings();

  const companiesRaw = pick(rec, KEYS.companies, process.env.JOB_RADAR_COMPANIES) ?? "";
  const greenhouseRaw = pick(rec, KEYS.greenhouse, process.env.JOB_RADAR_GREENHOUSE) ?? "";
  const leverRaw = pick(rec, KEYS.lever, process.env.JOB_RADAR_LEVER) ?? "";
  const keywordsRaw = pick(rec, KEYS.keywords, process.env.JOB_RADAR_KEYWORDS);
  const departmentsRaw = pick(rec, KEYS.departments, process.env.JOB_RADAR_DEPARTMENTS) ?? "";

  return {
    enabled: parseBool(pick(rec, KEYS.enabled, process.env.ENABLE_JOB_RADAR), false),
    companies: parseCsv(companiesRaw),
    // bci on por defecto (env JOB_RADAR_BCI=false lo apaga)
    bci: parseBool(
      pick(rec, KEYS.bci, process.env.JOB_RADAR_BCI === "false" ? "false" : undefined),
      true
    ),
    getonbrd: parseBool(pick(rec, KEYS.getonbrd, process.env.JOB_RADAR_GETONBRD), false),
    greenhouse: parseCsv(greenhouseRaw),
    lever: parseCsv(leverRaw),
    keywords: keywordsRaw === undefined ? DEFAULT_KEYWORDS : parseCsv(keywordsRaw),
    departments: parseCsv(departmentsRaw),
    cron: pick(rec, KEYS.cron, process.env.JOB_RADAR_CRON) || JOB_RADAR_DEFAULT_CRON,
    telegram: {
      botToken: pick(rec, KEYS.telegramBotToken, process.env.TELEGRAM_BOT_TOKEN) ?? "",
      chatId: pick(rec, KEYS.telegramChatId, process.env.TELEGRAM_CHAT_ID) ?? "",
    },
  };
}

// Una fuente a sincronizar: identificada por (source, company) y su fetcher.
interface JobSource {
  source: string;
  company: string;
  label: string;
  fetch: () => Promise<RawJob[]>;
}

function getSources(config: JobRadarConfig): JobSource[] {
  const sources: JobSource[] = [];
  for (const company of config.companies) {
    sources.push({
      source: "teamtailor",
      company,
      label: `teamtailor:${company}`,
      fetch: () => fetchTeamtailorJobs(company),
    });
  }
  if (config.bci) {
    sources.push({ source: "bci", company: "bci", label: "bci", fetch: fetchBciJobs });
  }
  if (config.getonbrd) {
    sources.push({
      source: "getonbrd",
      company: "getonbrd",
      label: "getonbrd",
      fetch: () => fetchGetonbrdJobs(config.keywords),
    });
  }
  for (const board of config.greenhouse) {
    sources.push({
      source: "greenhouse",
      company: board,
      label: `greenhouse:${board}`,
      fetch: () => fetchGreenhouseJobs(board),
    });
  }
  for (const company of config.lever) {
    sources.push({
      source: "lever",
      company,
      label: `lever:${company}`,
      fetch: () => fetchLeverJobs(company),
    });
  }
  return sources;
}

export interface JobRadarSyncOptions {
  triggerSource?: "cron" | "manual";
}

export interface JobRadarSyncResult {
  sources: string[];
  fetched: number;
  inserted: number;
  updated: number;
  closed: number;
  notified: number;
}

// ZenStack Json fields esperan un JSON value, no `unknown`. raw viene de
// JSON.parse así que round-trip lo normaliza de forma segura.
function toJsonValue(value: unknown): Exclude<JsonValue, null> | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Exclude<JsonValue, null>;
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function formatJobMessage(job: RawJob): string {
  const lines = [`🛰️ <b>${escapeHtml(job.title)}</b>`, `🏢 ${escapeHtml(job.company)}`];
  if (job.department) lines.push(`📂 ${escapeHtml(job.department)}`);
  if (job.location || job.remote) {
    lines.push(
      `📍 ${escapeHtml(job.location ?? "")}${job.remote ? ` · ${escapeHtml(job.remote)}` : ""}`.trim()
    );
  }
  lines.push(`🔗 ${escapeHtml(job.url)}`);
  return lines.join("\n");
}

async function upsertSourceJobs(
  src: JobSource,
  jobs: RawJob[],
  filter: ProfileFilter
): Promise<{ inserted: number; updated: number; closed: number }> {
  let inserted = 0;
  let updated = 0;
  const now = new Date();
  const presentIds: string[] = [];

  for (const job of jobs) {
    presentIds.push(job.externalId);
    const matched = matchesProfile(job, filter);
    const existing = await db.jobPosting.findUnique({
      where: {
        source_company_externalId: {
          source: job.source,
          company: job.company,
          externalId: job.externalId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await db.jobPosting.update({
        where: { id: existing.id },
        data: {
          title: job.title,
          url: job.url,
          department: job.department,
          location: job.location,
          remote: job.remote,
          descriptionHtml: job.descriptionHtml,
          publishedAt: job.publishedAt,
          lastmod: job.lastmod,
          status: "OPEN",
          matched,
          lastSeenAt: now,
          raw: toJsonValue(job.raw),
        },
      });
      updated += 1;
    } else {
      await db.jobPosting.create({
        data: {
          source: job.source,
          company: job.company,
          externalId: job.externalId,
          title: job.title,
          url: job.url,
          department: job.department,
          location: job.location,
          remote: job.remote,
          descriptionHtml: job.descriptionHtml,
          publishedAt: job.publishedAt,
          lastmod: job.lastmod,
          status: "OPEN",
          matched,
          notified: false,
          firstSeenAt: now,
          lastSeenAt: now,
          raw: toJsonValue(job.raw),
        },
      });
      inserted += 1;
    }
  }

  // Las que ya no aparecen en la fuente → CLOSED (solo si trajimos algo;
  // una respuesta vacía por error transitorio no debe cerrar todo).
  let closed = 0;
  if (presentIds.length > 0) {
    const res = await db.jobPosting.updateMany({
      where: {
        source: src.source,
        company: src.company,
        status: "OPEN",
        externalId: { notIn: presentIds },
      },
      data: { status: "CLOSED" },
    });
    closed = res.count ?? 0;
  }

  return { inserted, updated, closed };
}

async function notifyNewMatches(creds: TelegramCreds | null): Promise<number> {
  if (!telegramConfigured(creds)) {
    logWarn("job_radar.notify.skipped_no_telegram", {});
    return 0;
  }
  const pending = await db.jobPosting.findMany({
    where: { status: "OPEN", matched: true, notified: false },
    orderBy: { firstSeenAt: "asc" },
  });
  let notified = 0;
  for (const job of pending) {
    const ok = await sendTelegramMessage(
      formatJobMessage({
        source: job.source,
        company: job.company,
        externalId: job.externalId,
        title: job.title,
        url: job.url,
        department: job.department,
        location: job.location,
        remote: job.remote,
        descriptionHtml: job.descriptionHtml,
        publishedAt: job.publishedAt,
        lastmod: job.lastmod,
        raw: job.raw,
      }),
      creds
    );
    if (!ok) break; // Telegram caído → reintenta en la próxima corrida
    await db.jobPosting.update({ where: { id: job.id }, data: { notified: true } });
    notified += 1;
  }
  return notified;
}

export async function syncJobRadar(options: JobRadarSyncOptions = {}): Promise<JobRadarSyncResult> {
  const started = Date.now();
  const trigger = options.triggerSource ?? "manual";
  const config = await getJobRadarConfig();

  // Cron respeta el flag DB `jobRadar.enabled`; el sync manual (botón dashboard)
  // corre siempre.
  if (trigger === "cron" && !config.enabled) {
    logEvent("job_radar.skipped_disabled", { trigger });
    return { sources: [], fetched: 0, inserted: 0, updated: 0, closed: 0, notified: 0 };
  }

  const sources = getSources(config);
  if (sources.length === 0) {
    throw new DomainError(
      "BAD_REQUEST",
      "Sin fuentes configuradas (agrega empresas Teamtailor o activa BCI en ajustes)"
    );
  }
  const filter: ProfileFilter = { keywords: config.keywords, departments: config.departments };

  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let closed = 0;

  for (const src of sources) {
    const jobs = await src.fetch();
    fetched += jobs.length;
    if (jobs.length === 0) {
      logWarn("job_radar.source.empty", { source: src.label });
      continue;
    }
    const r = await upsertSourceJobs(src, jobs, filter);
    inserted += r.inserted;
    updated += r.updated;
    closed += r.closed;
  }

  const notified = await notifyNewMatches(config.telegram);

  const labels = sources.map((s) => s.label);
  logEvent("job_radar.done", {
    ms: Date.now() - started,
    triggerSource: trigger,
    sources: labels,
    fetched,
    inserted,
    updated,
    closed,
    notified,
  });

  return { sources: labels, fetched, inserted, updated, closed, notified };
}

// ── Dashboard (lectura + gestión manual de estados) ──────────────────────────

export type ApplicationStatus =
  | "NEW"
  | "SEEN"
  | "INTERESTED"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "DISCARDED";

export interface ListJobPostingsFilters {
  postingStatus?: "OPEN" | "CLOSED" | "ALL";
  applicationStatus?: ApplicationStatus;
  source?: string;
  search?: string;
}

export async function listJobPostings(filters: ListJobPostingsFilters = {}) {
  const where: Record<string, unknown> = {};
  if (filters.postingStatus && filters.postingStatus !== "ALL") {
    where.status = filters.postingStatus;
  } else if (!filters.postingStatus) {
    where.status = "OPEN";
  }
  if (filters.applicationStatus) where.applicationStatus = filters.applicationStatus;
  if (filters.source) where.source = filters.source;
  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" as const } },
      { department: { contains: q, mode: "insensitive" as const } },
      { location: { contains: q, mode: "insensitive" as const } },
      { company: { contains: q, mode: "insensitive" as const } },
    ];
  }
  return db.jobPosting.findMany({
    where,
    orderBy: [{ applicationStatus: "asc" }, { firstSeenAt: "desc" }],
  });
}

export interface UpdateJobApplicationInput {
  id: string;
  applicationStatus?: ApplicationStatus;
  notes?: string | null;
}

export async function updateJobApplication(input: UpdateJobApplicationInput) {
  const existing = await db.jobPosting.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!existing) throw new DomainError("NOT_FOUND", "Oferta no encontrada");

  const now = new Date();
  const data: Record<string, unknown> = {};
  if (input.applicationStatus) {
    data.applicationStatus = input.applicationStatus;
    data.statusUpdatedAt = now;
    if (input.applicationStatus === "APPLIED") data.appliedAt = now;
  }
  if (input.notes !== undefined) data.notes = input.notes;

  return db.jobPosting.update({ where: { id: input.id }, data });
}

// ── Ajustes (DB-backed, editables desde el dashboard) ────────────────────────

export interface JobRadarSettingsDTO {
  enabled: boolean;
  companies: string; // CSV
  bci: boolean;
  getonbrd: boolean;
  greenhouse: string; // CSV
  lever: string; // CSV
  keywords: string; // CSV
  departments: string; // CSV
  cron: string;
  telegramBotToken: string;
  telegramChatId: string;
}

export async function getJobRadarSettings(): Promise<JobRadarSettingsDTO> {
  const config = await getJobRadarConfig();
  return {
    enabled: config.enabled,
    companies: config.companies.join(", "),
    bci: config.bci,
    getonbrd: config.getonbrd,
    greenhouse: config.greenhouse.join(", "),
    lever: config.lever.join(", "),
    keywords: config.keywords.join(", "),
    departments: config.departments.join(", "),
    cron: config.cron,
    telegramBotToken: config.telegram.botToken,
    telegramChatId: config.telegram.chatId,
  };
}

export interface UpdateJobRadarSettingsInput {
  enabled?: boolean;
  companies?: string;
  bci?: boolean;
  getonbrd?: boolean;
  greenhouse?: string;
  lever?: string;
  keywords?: string;
  departments?: string;
  cron?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export async function updateJobRadarSettings(
  input: UpdateJobRadarSettingsInput
): Promise<JobRadarSettingsDTO> {
  const rows: Record<string, string> = {};
  if (input.enabled !== undefined) rows[KEYS.enabled] = input.enabled ? "true" : "false";
  if (input.bci !== undefined) rows[KEYS.bci] = input.bci ? "true" : "false";
  if (input.getonbrd !== undefined) rows[KEYS.getonbrd] = input.getonbrd ? "true" : "false";
  if (input.companies !== undefined) rows[KEYS.companies] = input.companies;
  if (input.greenhouse !== undefined) rows[KEYS.greenhouse] = input.greenhouse;
  if (input.lever !== undefined) rows[KEYS.lever] = input.lever;
  if (input.keywords !== undefined) rows[KEYS.keywords] = input.keywords;
  if (input.departments !== undefined) rows[KEYS.departments] = input.departments;
  if (input.cron !== undefined) rows[KEYS.cron] = input.cron;
  if (input.telegramBotToken !== undefined) rows[KEYS.telegramBotToken] = input.telegramBotToken;
  if (input.telegramChatId !== undefined) rows[KEYS.telegramChatId] = input.telegramChatId;

  if (Object.keys(rows).length > 0) await updateSettings(rows);
  return getJobRadarSettings();
}
