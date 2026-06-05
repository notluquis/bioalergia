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
import { fetchBciJobs } from "../modules/job-radar/bci.ts";
import { getProfileFilter, matchesProfile } from "../modules/job-radar/filter.ts";
import { fetchTeamtailorJobs } from "../modules/job-radar/teamtailor.ts";
import { sendTelegramMessage, telegramConfigured } from "../modules/job-radar/telegram.ts";
import type { RawJob } from "../modules/job-radar/types.ts";

// Una fuente a sincronizar: identificada por (source, company) y su fetcher.
interface JobSource {
  source: string;
  company: string;
  label: string;
  fetch: () => Promise<RawJob[]>;
}

function getSources(): JobSource[] {
  const sources: JobSource[] = [];

  // Teamtailor multi-empresa (CSV de subdominios)
  const companies = (process.env.JOB_RADAR_COMPANIES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  for (const company of companies) {
    sources.push({
      source: "teamtailor",
      company,
      label: `teamtailor:${company}`,
      fetch: () => fetchTeamtailorJobs(company),
    });
  }

  // BCI (trabajaenbci.cl) — on por defecto; apagar con JOB_RADAR_BCI=false
  if (process.env.JOB_RADAR_BCI !== "false") {
    sources.push({ source: "bci", company: "bci", label: "bci", fetch: fetchBciJobs });
  }

  if (sources.length === 0) {
    throw new DomainError(
      "BAD_REQUEST",
      "Sin fuentes configuradas (JOB_RADAR_COMPANIES vacío y JOB_RADAR_BCI=false)"
    );
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
  filter: ReturnType<typeof getProfileFilter>
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

async function notifyNewMatches(): Promise<number> {
  if (!telegramConfigured()) {
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
      })
    );
    if (!ok) break; // Telegram caído → reintenta en la próxima corrida
    await db.jobPosting.update({ where: { id: job.id }, data: { notified: true } });
    notified += 1;
  }
  return notified;
}

export async function syncJobRadar(options: JobRadarSyncOptions = {}): Promise<JobRadarSyncResult> {
  const started = Date.now();
  const sources = getSources();
  const filter = getProfileFilter();

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

  const notified = await notifyNewMatches();

  const labels = sources.map((s) => s.label);
  logEvent("job_radar.done", {
    ms: Date.now() - started,
    triggerSource: options.triggerSource ?? "manual",
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
