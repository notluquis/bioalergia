// Job Radar — sincroniza ofertas de empleo (Teamtailor multi-empresa) y notifica
// vía Telegram solo las NUEVAS que matchean el perfil. Toda la lógica/DB vive
// acá (handler/cron fino → llama un servicio), ver [project_architecture_golden_2026].
//
// Idempotente: upsert por (source, company, externalId). Las que dejan de
// aparecer en el sitemap se marcan CLOSED. Se notifica una sola vez por job
// (flag `notified`).

import { db, kysely, type JsonValue } from "@finanzas/db";
import { sql } from "kysely";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent, logWarn } from "../lib/logger.ts";
import { getSettings, updateSettings } from "../lib/settings.ts";
import { fetchAiravirtualJobs } from "../modules/job-radar/airavirtual.ts";
import { fetchAshbyJobs } from "../modules/job-radar/ashby.ts";
import { fetchBciJobs } from "../modules/job-radar/bci.ts";
import { fetchBukJobs } from "../modules/job-radar/buk.ts";
import { fetchComputrabajoJobs } from "../modules/job-radar/computrabajo.ts";
import { fetchEightfoldJobs } from "../modules/job-radar/eightfold.ts";
import { fetchMinisiteJobs } from "../modules/job-radar/minisite.ts";
import { fetchCdohrJobs } from "../modules/job-radar/cdohr.ts";
import { fetchCornerstoneJobs } from "../modules/job-radar/cornerstone.ts";
import { fetchGenomaworkJobs } from "../modules/job-radar/genomawork.ts";
import { fetchHirefrontJobs } from "../modules/job-radar/hirefront.ts";
import { fetchHiringRoomJobs } from "../modules/job-radar/hiringroom.ts";
import { fetchPandapeJobs } from "../modules/job-radar/pandape.ts";
import { fetchSfClassicJobs, parseSfClassicEntry } from "../modules/job-radar/sfclassic.ts";
import { fetchEmpleosPublicosJobs } from "../modules/job-radar/empleospublicos.ts";
import {
  DEFAULT_KEYWORDS,
  learnedKeywordsFromText,
  mergeProfileKeywords,
  matchesProfile,
  type ProfileFilter,
} from "../modules/job-radar/filter.ts";
import { fetchGetonbrdJobs } from "../modules/job-radar/getonbrd.ts";
import { fetchGreenhouseJobs } from "../modules/job-radar/greenhouse.ts";
import { fetchLeverJobs } from "../modules/job-radar/lever.ts";
import { fetchMueveteJobs } from "../modules/job-radar/muevete.ts";
import { fetchSmartRecruitersJobs } from "../modules/job-radar/smartrecruiters.ts";
import { normalizeJobSourceIdentifierAsync } from "../modules/job-radar/source-identifiers.ts";
import { fetchSuccessFactorsJobs } from "../modules/job-radar/successfactors.ts";
import { fetchTrabajandoJobs } from "../modules/job-radar/trabajando.ts";
import { fetchWorkdayJobs, parseWorkdayEntry } from "../modules/job-radar/workday.ts";
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
  bci: "jobRadar.bci",
  getonbrd: "jobRadar.getonbrd",
  empleospublicos: "jobRadar.empleospublicos",
  muevete: "jobRadar.muevete",
  keywords: "jobRadar.keywords",
  departments: "jobRadar.departments",
  cron: "jobRadar.cron",
  telegramBotToken: "jobRadar.telegramBotToken",
  telegramChatId: "jobRadar.telegramChatId",
} as const;

export interface JobRadarConfig {
  enabled: boolean;
  bci: boolean;
  getonbrd: boolean;
  empleospublicos: boolean;
  muevete: boolean;
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
  const keywordsRaw = pick(rec, KEYS.keywords, process.env.JOB_RADAR_KEYWORDS);
  const departmentsRaw = pick(rec, KEYS.departments, process.env.JOB_RADAR_DEPARTMENTS) ?? "";

  return {
    enabled: parseBool(pick(rec, KEYS.enabled, process.env.ENABLE_JOB_RADAR), false),
    // bci on por defecto (env JOB_RADAR_BCI=false lo apaga)
    bci: parseBool(
      pick(rec, KEYS.bci, process.env.JOB_RADAR_BCI === "false" ? "false" : undefined),
      true
    ),
    getonbrd: parseBool(pick(rec, KEYS.getonbrd, process.env.JOB_RADAR_GETONBRD), false),
    empleospublicos: parseBool(
      pick(rec, KEYS.empleospublicos, process.env.JOB_RADAR_EMPLEOSPUBLICOS),
      false
    ),
    // muevete (grupo Falabella) on por defecto
    muevete: parseBool(
      pick(rec, KEYS.muevete, process.env.JOB_RADAR_MUEVETE === "false" ? "false" : undefined),
      true
    ),
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

// Mapea una fila JobSource (kind + identifier) a su fetcher. null si el
// identifier es inválido (ej. Workday mal formado).
function sourceFromRow(
  kind: string,
  identifier: string,
  keywords: string[],
  rowLabel?: string | null
): JobSource | null {
  switch (kind) {
    case "TEAMTAILOR":
      return {
        source: "teamtailor",
        company: identifier,
        label: `teamtailor:${identifier}`,
        fetch: () => fetchTeamtailorJobs(identifier),
      };
    case "GREENHOUSE":
      return {
        source: "greenhouse",
        company: identifier,
        label: `greenhouse:${identifier}`,
        fetch: () => fetchGreenhouseJobs(identifier),
      };
    case "LEVER":
      return {
        source: "lever",
        company: identifier,
        label: `lever:${identifier}`,
        fetch: () => fetchLeverJobs(identifier),
      };
    case "ASHBY":
      return {
        source: "ashby",
        company: identifier,
        label: `ashby:${identifier}`,
        fetch: () => fetchAshbyJobs(identifier),
      };
    case "SMARTRECRUITERS":
      return {
        source: "smartrecruiters",
        company: identifier,
        label: `smartrecruiters:${identifier}`,
        fetch: () => fetchSmartRecruitersJobs(identifier),
      };
    case "AIRAVIRTUAL":
      return {
        source: "airavirtual",
        company: identifier,
        label: `airavirtual:${identifier}`,
        fetch: () => fetchAiravirtualJobs(identifier),
      };
    case "SUCCESSFACTORS":
      return {
        source: "successfactors",
        company: identifier,
        label: `successfactors:${identifier}`,
        fetch: () => fetchSuccessFactorsJobs(identifier),
      };
    case "TRABAJANDO":
      return {
        source: "trabajando",
        company: identifier,
        label: `trabajando:${identifier}`,
        fetch: () => fetchTrabajandoJobs(identifier),
      };
    case "SFCLASSIC": {
      // El tenant code SAP no es legible; preferimos el label de la fila.
      const sfCompany = rowLabel?.trim() || parseSfClassicEntry(identifier)?.company || identifier;
      return {
        source: "sfclassic",
        company: sfCompany,
        label: `sfclassic:${sfCompany}`,
        fetch: () => fetchSfClassicJobs(identifier, rowLabel),
      };
    }
    case "GENOMAWORK":
      return {
        source: "genomawork",
        company: identifier,
        label: `genomawork:${identifier}`,
        fetch: () => fetchGenomaworkJobs(identifier),
      };
    case "HIRINGROOM":
      return {
        source: "hiringroom",
        company: identifier,
        label: `hiringroom:${identifier}`,
        fetch: () => fetchHiringRoomJobs(identifier),
      };
    case "BUK":
      return {
        source: "buk",
        company: identifier,
        label: `buk:${identifier}`,
        fetch: () => fetchBukJobs(identifier),
      };
    case "HIREFRONT":
      return {
        source: "hirefront",
        company: identifier,
        label: `hirefront:${identifier}`,
        fetch: () => fetchHirefrontJobs(identifier),
      };
    case "CORNERSTONE":
      return {
        source: "cornerstone",
        company: identifier.split(":")[0] ?? identifier,
        label: `cornerstone:${identifier}`,
        fetch: () => fetchCornerstoneJobs(identifier),
      };
    case "PANDAPE":
      return {
        source: "pandape",
        company: identifier,
        label: `pandape:${identifier}`,
        fetch: () => fetchPandapeJobs(identifier),
      };
    case "COMPUTRABAJO":
      return {
        source: "computrabajo",
        company: identifier,
        label: `computrabajo:${identifier}`,
        fetch: () => fetchComputrabajoJobs(identifier),
      };
    case "EIGHTFOLD":
      return {
        source: "eightfold",
        company: identifier.split(":")[0] ?? identifier,
        label: `eightfold:${identifier.split(":")[0] ?? identifier}`,
        fetch: () => fetchEightfoldJobs(identifier),
      };
    case "MINISITE":
      return {
        source: "minisite",
        company: identifier,
        label: `minisite:${identifier}`,
        fetch: () => fetchMinisiteJobs(identifier),
      };
    case "CDOHR":
      return {
        source: "cdohr",
        company: identifier,
        label: `cdohr:${identifier}`,
        fetch: () => fetchCdohrJobs(identifier),
      };
    // MUEVETE (grupo Falabella) NO es fila: es toggle global `config.muevete`
    // (como BCI/GetOnBoard), porque es una fuente única que agrega todas las
    // marcas del grupo. Ver getSources().
    case "WORKDAY": {
      const entry = parseWorkdayEntry(identifier);
      if (!entry) {
        logWarn("job_radar.workday.bad_entry", { identifier });
        return null;
      }
      return {
        source: "workday",
        company: entry.tenant,
        label: `workday:${entry.tenant}`,
        fetch: () => fetchWorkdayJobs(entry, keywords),
      };
    }
    default:
      return null;
  }
}

// Fuentes activas: filas habilitadas en job_sources (por kind+identifier) +
// BCI / GetOnBoard que son toggles globales en settings (sin identifier).
async function getSources(config: JobRadarConfig): Promise<JobSource[]> {
  const sources: JobSource[] = [];
  const rows = await db.jobSource.findMany({ where: { enabled: true } });
  for (const row of rows) {
    const s = sourceFromRow(row.kind, row.identifier, config.keywords, row.label);
    if (s) sources.push(s);
  }
  if (config.bci) {
    sources.push({ source: "bci", company: "bci", label: "bci", fetch: fetchBciJobs });
  }
  if (config.muevete) {
    sources.push({
      source: "muevete",
      company: "falabella",
      label: "muevete",
      fetch: fetchMueveteJobs,
    });
  }
  if (config.getonbrd) {
    sources.push({
      source: "getonbrd",
      company: "getonbrd",
      label: "getonbrd",
      fetch: () => fetchGetonbrdJobs(config.keywords),
    });
  }
  if (config.empleospublicos) {
    // Pre-cargar externalIds que ya tienen descripción → el adapter NO re-fetchea
    // su detalle (la descripción no cambia). Evita ~276 requests por sync.
    const describedRows = await db.jobPosting.findMany({
      where: { source: "empleospublicos", descriptionHtml: { not: null } },
      select: { externalId: true },
    });
    const describedIds = new Set(describedRows.map((r) => r.externalId));
    sources.push({
      source: "empleospublicos",
      company: "empleospublicos",
      label: "empleospublicos",
      fetch: () => fetchEmpleosPublicosJobs(describedIds),
    });
  }
  return sources;
}

async function getLearnedProfileKeywords(): Promise<string[]> {
  const rows = await db.jobPosting.findMany({
    where: { applicationStatus: { in: ["INTERESTED", "APPLIED"] } },
    select: { title: true, department: true, descriptionHtml: true },
    take: 200,
    orderBy: [{ statusUpdatedAt: "desc" }, { firstSeenAt: "desc" }],
  });

  return learnedKeywordsFromText(
    rows.map((row) => `${row.title} ${row.department ?? ""} ${row.descriptionHtml ?? ""}`)
  );
}

export interface JobRadarSyncOptions {
  triggerSource?: "cron" | "manual";
}

export interface JobRadarSyncResult {
  sources: string[];
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  closed: number;
  notified: number;
}

// ZenStack Json fields esperan un JSON value, no `unknown`. raw viene de
// JSON.parse así que round-trip lo normaliza de forma segura.
function toJsonValue(value: unknown): Exclude<JsonValue, null> | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Exclude<JsonValue, null>;
}

// Las ofertas son día-granular. Varios adapters producen publishedAt/lastmod
// no-determinista por TIEMPO: airavirtual/computrabajo/hirefront usan `now - días`
// (cambia cada fetch) y muevete/trabajando parsean datetime en TZ local (shift
// horario). Cualquier diferencia de hora dispara el upsert (updated) en cada sync
// aunque el DÍA no cambie. Anclar a medianoche UTC → estable e idéntico entre
// syncs. Ver [[project_datetime_architecture]].
function floorToUtcDay(d: Date | null): Date | null {
  if (!d) return null;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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
  if (job.salary) lines.push(`💰 ${escapeHtml(job.salary)}`);
  lines.push(`🔗 ${escapeHtml(job.url)}`);
  return lines.join("\n");
}

// Filas por statement del bulk upsert (cada fila ~20 params → 400×20=8000 < 65535).
const UPSERT_CHUNK = 400;

function jobUpsertKey(job: Pick<RawJob, "source" | "company" | "externalId">): string {
  return `${job.source}\u0000${job.company}\u0000${job.externalId}`;
}

export function dedupeJobsForUpsert(jobs: RawJob[]): { jobs: RawJob[]; duplicateCount: number } {
  const byKey = new Map<string, RawJob>();
  for (const job of jobs) {
    byKey.set(jobUpsertKey(job), job);
  }
  return { jobs: [...byKey.values()], duplicateCount: jobs.length - byKey.size };
}

async function upsertSourceJobs(
  src: JobSource,
  sourceJobs: RawJob[],
  filter: ProfileFilter
): Promise<{ inserted: number; updated: number; unchanged: number; closed: number }> {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const now = new Date();
  const { jobs, duplicateCount } = dedupeJobsForUpsert(sourceJobs);
  if (duplicateCount > 0) {
    logWarn("job_radar.source.duplicates_deduped", {
      source: src.label,
      duplicates: duplicateCount,
      fetched: sourceJobs.length,
      unique: jobs.length,
    });
  }
  const presentIds: string[] = jobs.map((j) => j.externalId);

  // Bulk upsert: UN `INSERT … ON CONFLICT DO UPDATE` por chunk en vez de
  // findUnique+update/create por oferta (eran ~2 round-trips/oferta → 90s+ con
  // miles de ofertas contra la DB remota). `xmax = 0` distingue insert de update.
  // ON CONFLICT NO toca first_seen_at/notified/application_status/notes/appliedAt
  // (estado del usuario), solo refresca los campos de la oferta + status OPEN.
  //
  // kept raw: ZenStack ORM no tiene equivalente semánticamente idéntico. createMany
  // ({ skipDuplicates }) SALTA los conflictos (no actualiza) y solo devuelve un
  // total de inserts → se pierden los contadores `updated`/`unchanged`. upsert es
  // per-fila (reintroduce los N round-trips que este chunked upsert eliminó). El
  // discriminador insert/update (xmax = 0) y el filtro `IS DISTINCT FROM` que
  // produce el bucket `unchanged` no tienen primitiva ORM. Bucket-D del prompt
  // (INSERT … ON CONFLICT bulk queda raw).
  for (let i = 0; i < jobs.length; i += UPSERT_CHUNK) {
    const chunk = jobs.slice(i, i + UPSERT_CHUNK);
    const values = chunk.map((job) => {
      const raw = toJsonValue(job.raw);
      return sql`(
        gen_random_uuid()::text, ${job.source}, ${job.company}, ${job.externalId},
        ${job.title}, ${job.url}, ${job.department}, ${job.location}, ${job.remote},
        ${job.salary}, ${job.descriptionHtml}, ${floorToUtcDay(job.publishedAt)}, ${floorToUtcDay(job.lastmod)},
        'OPEN'::personal."JobPostingStatus", ${matchesProfile(job, filter)}, false,
        'NEW'::personal."JobApplicationStatus", ${now}, ${now},
        ${raw === undefined ? null : JSON.stringify(raw)}::jsonb
      )`;
    });
    const result = await sql<{ inserted: boolean }>`
      INSERT INTO personal.job_postings
        (id, source, company, external_id, title, url, department, location, remote,
         salary, description_html, published_at, lastmod, status, matched, notified,
         application_status, first_seen_at, last_seen_at, raw)
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (source, company, external_id) DO UPDATE SET
        title = EXCLUDED.title, url = EXCLUDED.url,
        -- Campos enriquecidos vía detalle (department/location/salary/description/
        -- published_at): COALESCE preserva lo guardado cuando el adapter saltó el
        -- enriquecido (devuelve null) → no se pierde data ni se churnea el upsert.
        department = COALESCE(EXCLUDED.department, personal.job_postings.department),
        location = COALESCE(EXCLUDED.location, personal.job_postings.location),
        remote = EXCLUDED.remote,
        salary = COALESCE(EXCLUDED.salary, personal.job_postings.salary),
        description_html = COALESCE(EXCLUDED.description_html, personal.job_postings.description_html),
        published_at = COALESCE(EXCLUDED.published_at, personal.job_postings.published_at),
        lastmod = EXCLUDED.lastmod, status = 'OPEN'::personal."JobPostingStatus",
        matched = EXCLUDED.matched, last_seen_at = EXCLUDED.last_seen_at, raw = EXCLUDED.raw
      WHERE
        personal.job_postings.title IS DISTINCT FROM EXCLUDED.title OR
        personal.job_postings.url IS DISTINCT FROM EXCLUDED.url OR
        personal.job_postings.department IS DISTINCT FROM
          COALESCE(EXCLUDED.department, personal.job_postings.department) OR
        personal.job_postings.location IS DISTINCT FROM
          COALESCE(EXCLUDED.location, personal.job_postings.location) OR
        personal.job_postings.remote IS DISTINCT FROM EXCLUDED.remote OR
        personal.job_postings.salary IS DISTINCT FROM
          COALESCE(EXCLUDED.salary, personal.job_postings.salary) OR
        personal.job_postings.description_html IS DISTINCT FROM
          COALESCE(EXCLUDED.description_html, personal.job_postings.description_html) OR
        personal.job_postings.published_at IS DISTINCT FROM
          COALESCE(EXCLUDED.published_at, personal.job_postings.published_at) OR
        personal.job_postings.lastmod IS DISTINCT FROM EXCLUDED.lastmod OR
        personal.job_postings.status IS DISTINCT FROM 'OPEN'::personal."JobPostingStatus" OR
        personal.job_postings.matched IS DISTINCT FROM EXCLUDED.matched
      RETURNING (xmax = 0) AS inserted
    `.execute(kysely);
    unchanged += chunk.length - result.rows.length;
    for (const r of result.rows) {
      if (r.inserted) inserted += 1;
      else updated += 1;
    }
  }

  // Las que ya no aparecen en la fuente → CLOSED (solo si trajimos algo;
  // una respuesta vacía por error transitorio no debe cerrar todo).
  // OJO: cerramos por las companies REALMENTE vistas en este batch, NO por
  // `src.company`: varios adapters guardan job.company ≠ identifier (trabajando
  // = "CGE S.A." vs slug "cge", muevete = marca vs "falabella", genomawork =
  // "Sky Airline" vs slug) → filtrar por src.company nunca cerraba esas filas.
  let closed = 0;
  if (presentIds.length > 0) {
    const presentCompanies = [...new Set(jobs.map((j) => j.company))];
    const res = await db.jobPosting.updateMany({
      where: {
        source: src.source,
        company: { in: presentCompanies },
        status: "OPEN",
        externalId: { notIn: presentIds },
      },
      data: { status: "CLOSED" },
    });
    closed = res.count ?? 0;
  }

  return { inserted, updated, unchanged, closed };
}

// Clave de dedup cross-source (título normalizado + empleador). getonbrd guarda
// "Cargo · Empleador"; el resto usa company. Espeja apps/intranet .../dedupe.ts.
function notifyKey(title: string, source: string, company: string): string {
  let base = title;
  let employer = company;
  if (source === "getonbrd") {
    const idx = title.lastIndexOf(" · ");
    if (idx > 0) {
      base = title.slice(0, idx);
      employer = title.slice(idx + 3);
    }
  }
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(base)}@${norm(employer)}`;
}

// Tope de avisos por corrida: evita ráfagas a Telegram (rate-limit 429) cuando
// entra un backlog grande, p.ej. tras sumar muchas fuentes nuevas. El resto
// queda notified=false y se drena en las siguientes corridas (orden FIFO).
const MAX_NOTIFY_PER_RUN = 25;

async function notifyNewMatches(creds: TelegramCreds | null): Promise<number> {
  if (!telegramConfigured(creds)) {
    logWarn("job_radar.notify.skipped_no_telegram", {});
    return 0;
  }
  const pending = await db.jobPosting.findMany({
    where: { status: "OPEN", matched: true, notified: false },
    orderBy: [{ firstSeenAt: "asc" }, { id: "asc" }],
  });

  // Dedup cross-source: una misma oferta en 2 fuentes se avisa UNA vez; igual se
  // marcan notified todas las filas del grupo para no re-avisar la próxima corrida.
  const groups = new Map<string, typeof pending>();
  for (const job of pending) {
    const key = notifyKey(job.title, job.source, job.company);
    const arr = groups.get(key);
    if (arr) arr.push(job);
    else groups.set(key, [job]);
  }

  let notified = 0;
  for (const group of groups.values()) {
    if (notified >= MAX_NOTIFY_PER_RUN) break; // resto se drena la próxima corrida
    const job = group[0];
    if (!job) continue;
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
        salary: job.salary,
        descriptionHtml: job.descriptionHtml,
        publishedAt: job.publishedAt,
        lastmod: job.lastmod,
        raw: job.raw,
      }),
      creds
    );
    if (!ok) break; // Telegram caído → reintenta en la próxima corrida
    await db.jobPosting.updateMany({
      where: { id: { in: group.map((g) => g.id) } },
      data: { notified: true },
    });
    notified += 1;
  }
  return notified;
}

// ── Progreso del sync (in-memory, mismo proceso que el botón y el cron) ───────
// El dashboard lo poll-ea durante el refresh para mostrar fase/avance/ETA.
export interface JobRadarSyncProgress {
  running: boolean;
  phase: "idle" | "fetching" | "saving" | "notifying" | "done";
  total: number;
  done: number;
  fetched: number;
  currentLabel: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  result: JobRadarSyncResult | null;
}

let syncProgress: JobRadarSyncProgress = {
  running: false,
  phase: "idle",
  total: 0,
  done: 0,
  fetched: 0,
  currentLabel: null,
  startedAt: null,
  finishedAt: null,
  result: null,
};

export function getJobRadarSyncProgress(): JobRadarSyncProgress {
  return syncProgress;
}

export function markJobRadarSyncStarting(): JobRadarSyncProgress {
  if (getJobRadarSyncProgress().running) return syncProgress;
  syncProgress = {
    running: true,
    phase: "fetching",
    total: 0,
    done: 0,
    fetched: 0,
    currentLabel: null,
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
  };
  return syncProgress;
}

export function markJobRadarSyncFailed(): JobRadarSyncProgress {
  syncProgress = {
    ...syncProgress,
    running: false,
    phase: "done",
    finishedAt: Date.now(),
  };
  return syncProgress;
}

export function startJobRadarSync(options: JobRadarSyncOptions = {}): JobRadarSyncProgress {
  if (getJobRadarSyncProgress().running) return syncProgress;
  markJobRadarSyncStarting();
  void syncJobRadar(options).catch((error) => {
    markJobRadarSyncFailed();
    logError("job_radar.background_failed", error, {
      triggerSource: options.triggerSource ?? "manual",
    });
  });
  return syncProgress;
}

export async function syncJobRadar(options: JobRadarSyncOptions = {}): Promise<JobRadarSyncResult> {
  const started = Date.now();
  const trigger = options.triggerSource ?? "manual";
  const config = await getJobRadarConfig();

  // Cron respeta el flag DB `jobRadar.enabled`; el sync manual (botón dashboard)
  // corre siempre.
  if (trigger === "cron" && !config.enabled) {
    logEvent("job_radar.skipped_disabled", { trigger });
    return {
      sources: [],
      fetched: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      closed: 0,
      notified: 0,
    };
  }

  const sources = await getSources(config);
  if (sources.length === 0) {
    throw new DomainError(
      "BAD_REQUEST",
      "Sin fuentes configuradas (agrega fuentes o activa BCI/GetOnBoard en ajustes)"
    );
  }
  const learnedKeywords = await getLearnedProfileKeywords();
  const filter: ProfileFilter = {
    keywords: mergeProfileKeywords(config.keywords, learnedKeywords),
    departments: config.departments,
  };

  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let closed = 0;

  syncProgress = {
    running: true,
    phase: "fetching",
    total: sources.length,
    done: 0,
    fetched: 0,
    currentLabel: null,
    startedAt: started,
    finishedAt: null,
    result: null,
  };

  // Fetch de todas las fuentes EN PARALELO (la parte lenta es la red). Cada
  // adapter ya captura sus errores → []; el .catch es defensa extra para que
  // una fuente caída no tumbe el Promise.all. El upsert (DB) queda secuencial
  // por fuente para no contender la conexión ni cruzar la lógica de CLOSED.
  const results = await Promise.all(
    sources.map(async (src) => {
      const jobs = await src.fetch().catch(() => [] as RawJob[]);
      // Avance de la fase de fetch: cada fuente que resuelve suma.
      syncProgress = {
        ...syncProgress,
        done: syncProgress.done + 1,
        fetched: syncProgress.fetched + jobs.length,
        currentLabel: src.label,
      };
      return { src, jobs };
    })
  );

  // Fase de guardado (secuencial): reiniciamos el contador sobre las fuentes con
  // ofertas. Es la parte más lenta (upsert por oferta) → progreso fino acá.
  const withJobs = results.filter((r) => r.jobs.length > 0);
  syncProgress = { ...syncProgress, phase: "saving", total: withJobs.length, done: 0 };
  for (const { src, jobs } of results) {
    fetched += jobs.length;
    if (jobs.length === 0) {
      logWarn("job_radar.source.empty", { source: src.label });
      continue;
    }
    syncProgress = { ...syncProgress, currentLabel: src.label };
    const r = await upsertSourceJobs(src, jobs, filter);
    inserted += r.inserted;
    updated += r.updated;
    unchanged += r.unchanged;
    closed += r.closed;
    syncProgress = { ...syncProgress, done: syncProgress.done + 1 };
  }

  syncProgress = { ...syncProgress, phase: "notifying", currentLabel: null };
  const notified = await notifyNewMatches(config.telegram);
  const result = {
    sources: sources.map((s) => s.label),
    fetched,
    inserted,
    updated,
    unchanged,
    closed,
    notified,
  };
  syncProgress = {
    ...syncProgress,
    running: false,
    phase: "done",
    finishedAt: Date.now(),
    result,
  };

  logEvent("job_radar.done", {
    ms: Date.now() - started,
    triggerSource: trigger,
    ...result,
  });

  return result;
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
  company?: string;
  search?: string;
}

export interface JobRadarFilterOptionsDTO {
  applicationStatuses: ApplicationStatus[];
  companies: Array<{ source: string; value: string }>;
  postingStatuses: Array<"OPEN" | "CLOSED">;
  rawLocations: Array<string | null>;
  remoteModes: string[];
  sources: string[];
}

const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "NEW",
  "SEEN",
  "INTERESTED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "DISCARDED",
];
const POSTING_STATUS_ORDER: Array<"OPEN" | "CLOSED"> = ["OPEN", "CLOSED"];

function orderedSubset<T extends string>(values: Iterable<T>, order: readonly T[]): T[] {
  const set = new Set(values);
  return order.filter((value) => set.has(value));
}

function buildJobPostingWhere(
  filters: ListJobPostingsFilters,
  omit: Array<keyof ListJobPostingsFilters> = []
): Record<string, unknown> {
  const skip = new Set<keyof ListJobPostingsFilters>(omit);
  const where: Record<string, unknown> = {};
  if (!skip.has("postingStatus")) {
    if (filters.postingStatus && filters.postingStatus !== "ALL") {
      where.status = filters.postingStatus;
    } else if (!filters.postingStatus) {
      where.status = "OPEN";
    }
  }
  if (!skip.has("applicationStatus") && filters.applicationStatus) {
    where.applicationStatus = filters.applicationStatus;
  }
  if (!skip.has("source") && filters.source) where.source = filters.source;
  if (!skip.has("company") && filters.company) where.company = filters.company;
  if (!skip.has("search") && filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" as const } },
      { department: { contains: q, mode: "insensitive" as const } },
      { location: { contains: q, mode: "insensitive" as const } },
      { company: { contains: q, mode: "insensitive" as const } },
    ];
  }
  return where;
}

async function listFacetRows(
  filters: ListJobPostingsFilters,
  omit: Array<keyof ListJobPostingsFilters> = []
) {
  return db.jobPosting.findMany({
    where: buildJobPostingWhere(filters, omit),
    select: {
      applicationStatus: true,
      company: true,
      location: true,
      remote: true,
      source: true,
      status: true,
    },
  });
}

export async function listJobRadarFilterOptions(
  filters: ListJobPostingsFilters = {}
): Promise<JobRadarFilterOptionsDTO> {
  const [applicationRows, companyRows, locationRows, postingRows, sourceRows] = await Promise.all([
    listFacetRows(filters, ["applicationStatus"]),
    listFacetRows(filters, ["company"]),
    listFacetRows(filters),
    listFacetRows(filters, ["postingStatus"]),
    listFacetRows(filters, ["source"]),
  ]);

  const companies = new Map<string, { source: string; value: string }>();
  for (const row of companyRows) {
    companies.set(`${row.source}\u0000${row.company}`, { source: row.source, value: row.company });
  }

  const locations = new Set<string | null>();
  const remoteModes = new Set<string>();
  for (const row of locationRows) {
    locations.add(row.location);
    if (row.remote) remoteModes.add(row.remote);
  }

  const sources = new Set<string>();
  for (const row of sourceRows) sources.add(row.source);

  return {
    applicationStatuses: orderedSubset(
      applicationRows.map((row) => row.applicationStatus as ApplicationStatus),
      APPLICATION_STATUS_ORDER
    ),
    companies: [...companies.values()].sort(
      (a, b) => a.source.localeCompare(b.source, "es") || a.value.localeCompare(b.value, "es")
    ),
    postingStatuses: orderedSubset(
      postingRows.map((row) => row.status as "OPEN" | "CLOSED"),
      POSTING_STATUS_ORDER
    ),
    rawLocations: [...locations].sort((a, b) => (a ?? "").localeCompare(b ?? "", "es")),
    remoteModes: [...remoteModes].sort((a, b) => a.localeCompare(b, "es")),
    sources: [...sources].sort((a, b) => a.localeCompare(b, "es")),
  };
}

export async function listJobPostings(filters: ListJobPostingsFilters = {}) {
  return db.jobPosting.findMany({
    where: buildJobPostingWhere(filters),
    // `id` como desempate ÚNICO y estable: firstSeenAt es idéntico en filas
    // insertadas en el mismo sync masivo, y sin desempate Postgres devuelve los
    // empates en orden de heap arbitrario que se reordena al mutar una fila
    // (marcar vista) → la página saltaba. id garantiza orden total determinístico.
    orderBy: [{ applicationStatus: "asc" }, { firstSeenAt: "desc" }, { id: "asc" }],
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

export interface BulkUpdateJobApplicationsInput {
  ids: string[];
  applicationStatus: ApplicationStatus;
}

export async function bulkUpdateJobApplications(input: BulkUpdateJobApplicationsInput) {
  const now = new Date();
  const data: Record<string, unknown> = {
    applicationStatus: input.applicationStatus,
    statusUpdatedAt: now,
  };
  if (input.applicationStatus === "APPLIED") data.appliedAt = now;

  const result = await db.jobPosting.updateMany({
    where: { id: { in: input.ids } },
    data,
  });
  return { count: result.count };
}

// ── Ajustes (DB-backed, editables desde el dashboard) ────────────────────────

export interface JobRadarSettingsDTO {
  enabled: boolean;
  bci: boolean;
  getonbrd: boolean;
  empleospublicos: boolean;
  muevete: boolean;
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
    bci: config.bci,
    getonbrd: config.getonbrd,
    empleospublicos: config.empleospublicos,
    muevete: config.muevete,
    keywords: config.keywords.join(", "),
    departments: config.departments.join(", "),
    cron: config.cron,
    telegramBotToken: config.telegram.botToken,
    telegramChatId: config.telegram.chatId,
  };
}

export interface UpdateJobRadarSettingsInput {
  enabled?: boolean;
  bci?: boolean;
  getonbrd?: boolean;
  empleospublicos?: boolean;
  muevete?: boolean;
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
  if (input.empleospublicos !== undefined)
    rows[KEYS.empleospublicos] = input.empleospublicos ? "true" : "false";
  if (input.muevete !== undefined) rows[KEYS.muevete] = input.muevete ? "true" : "false";
  if (input.keywords !== undefined) rows[KEYS.keywords] = input.keywords;
  if (input.departments !== undefined) rows[KEYS.departments] = input.departments;
  if (input.cron !== undefined) rows[KEYS.cron] = input.cron;
  if (input.telegramBotToken !== undefined) rows[KEYS.telegramBotToken] = input.telegramBotToken;
  if (input.telegramChatId !== undefined) rows[KEYS.telegramChatId] = input.telegramChatId;

  if (Object.keys(rows).length > 0) await updateSettings(rows);
  return getJobRadarSettings();
}

// ── Fuentes (filas job_sources) ──────────────────────────────────────────────

export type JobSourceKindDTO =
  | "TEAMTAILOR"
  | "GREENHOUSE"
  | "LEVER"
  | "ASHBY"
  | "SMARTRECRUITERS"
  | "WORKDAY"
  | "AIRAVIRTUAL"
  | "SUCCESSFACTORS"
  | "TRABAJANDO"
  | "SFCLASSIC"
  | "GENOMAWORK"
  | "HIRINGROOM"
  | "BUK"
  | "HIREFRONT"
  | "CORNERSTONE"
  | "PANDAPE"
  | "COMPUTRABAJO"
  | "EIGHTFOLD"
  | "MINISITE"
  | "CDOHR";

export async function listJobSources() {
  return db.jobSource.findMany({ orderBy: [{ kind: "asc" }, { identifier: "asc" }] });
}

export interface AddJobSourceInput {
  kind: JobSourceKindDTO;
  identifier: string;
  label?: string | null;
}

export async function addJobSource(input: AddJobSourceInput) {
  const identifier = await normalizeJobSourceIdentifierAsync(input.kind, input.identifier);
  if (identifier.length === 0) throw new DomainError("BAD_REQUEST", "Identificador vacío");
  if (input.kind === "WORKDAY" && !parseWorkdayEntry(identifier)) {
    throw new DomainError("BAD_REQUEST", "Workday debe ser 'tenant:wd:site'");
  }
  const existing = await db.jobSource.findUnique({
    where: { kind_identifier: { kind: input.kind, identifier } },
    select: { id: true },
  });
  if (existing) throw new DomainError("CONFLICT", "Esa fuente ya existe");
  return db.jobSource.create({
    data: { kind: input.kind, identifier, label: input.label?.trim() || null, enabled: true },
  });
}

export async function setJobSourceEnabled(id: string, enabled: boolean) {
  const existing = await db.jobSource.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new DomainError("NOT_FOUND", "Fuente no encontrada");
  return db.jobSource.update({ where: { id }, data: { enabled } });
}

export async function deleteJobSource(id: string) {
  const existing = await db.jobSource.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new DomainError("NOT_FOUND", "Fuente no encontrada");
  await db.jobSource.delete({ where: { id } });
  return { id };
}
