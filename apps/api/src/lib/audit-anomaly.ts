import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logAuditEvent } from "./audit-log.ts";
import { logEvent, logWarn } from "./logger.ts";
import { emitSecurityAlert } from "./security-alerts.ts";
import { getSetting } from "./settings.ts";

// Breach / anomaly detection over audit_logs (Ley 21.719 + ANCI: la clínica
// es "servicio esencial" → cadena de alerta 3h ante incidente). Runs every
// few minutes (cron in runner.ts) over a trailing window and emits a
// SecurityAlert + an AuditLog row per detected anomaly:
//
//   (a) mass-read      — count(CLINICAL_RECORD_READ) per user > threshold
//   (b) off-hours      — access outside [offHoursEnd, offHoursStart) Chile time
//   (c) bulk export    — count(DATA_EXPORT) per user > threshold
//   (d) failed-auth    — count(LOGIN_FAILURE|MFA_FAILURE) per ip > threshold
//   (e) lockout spike  — count(LOGIN_LOCKED) > threshold
//
// ALL thresholds/windows come from getSetting() (DB-config, read fresh each
// tick) with code defaults — NO hardcoded thresholds. emitSecurityAlert
// dedupes per (scope, alertType) so a sustained anomaly doesn't spam the
// operator; the underlying AuditLog row is always written.
//
// Refs:
//   - Ley 21.719 (Chile) — deber de resguardo / detección de brechas
//   - ANCI / Ley 21.663 — notificación de incidentes (servicio esencial, 3h)
//   - Ley 20.584 + Decreto 41/2012 — acceso a ficha clínica auditado
//   - NIST SP 800-53r5 AU-6(1) / SI-4 — automated anomaly detection

const TZ = "America/Santiago";

// Setting keys (DB-config). Defaults are conservative starting points; tune
// per clinic via the settings table without a code change.
const KEYS = {
  windowMinutes: "security.windowMinutes",
  massReadPerHour: "security.massReadPerHour",
  bulkExportPerHour: "security.bulkExportPerHour",
  failedAuthPerHour: "security.failedAuthPerHour",
  lockoutPerWindow: "security.lockoutPerWindow",
  offHoursStart: "security.offHoursStart",
  offHoursEnd: "security.offHoursEnd",
} as const;

const DEFAULTS = {
  windowMinutes: 60,
  // mass-read / bulk-export thresholds are expressed per-hour; we scale them
  // to the actual window length so a 15-min window uses a proportional cap.
  massReadPerHour: 50,
  bulkExportPerHour: 10,
  failedAuthPerHour: 20,
  lockoutPerWindow: 5,
  offHoursStart: 21, // 21:00 — anything at/after this is off-hours
  offHoursEnd: 7, // 07:00 — anything before this is off-hours
} as const;

async function settingInt(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key);
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type AnomalyKind =
  | "mass_read"
  | "off_hours"
  | "bulk_export"
  | "failed_auth"
  | "lockout_spike";

export type AnomalyFinding = {
  kind: AnomalyKind;
  scope: string;
  severity: "warning" | "critical";
  count: number;
  threshold: number;
  subject: string;
};

export type AuditAnomalyReport = {
  windowMinutes: number;
  findings: AnomalyFinding[];
  alertsEmitted: number;
  durationMs: number;
};

type Thresholds = {
  windowMinutes: number;
  massRead: number;
  bulkExport: number;
  failedAuth: number;
  lockout: number;
  offHoursStart: number;
  offHoursEnd: number;
};

async function loadThresholds(): Promise<Thresholds> {
  const windowMinutes = await settingInt(KEYS.windowMinutes, DEFAULTS.windowMinutes);
  const massReadPerHour = await settingInt(KEYS.massReadPerHour, DEFAULTS.massReadPerHour);
  const bulkExportPerHour = await settingInt(KEYS.bulkExportPerHour, DEFAULTS.bulkExportPerHour);
  const failedAuthPerHour = await settingInt(KEYS.failedAuthPerHour, DEFAULTS.failedAuthPerHour);
  const lockout = await settingInt(KEYS.lockoutPerWindow, DEFAULTS.lockoutPerWindow);
  const offHoursStart = await settingInt(KEYS.offHoursStart, DEFAULTS.offHoursStart);
  const offHoursEnd = await settingInt(KEYS.offHoursEnd, DEFAULTS.offHoursEnd);

  // Per-hour thresholds scaled to the window length (min 1).
  const scale = Math.max(windowMinutes / 60, 1 / 60);
  const scaled = (perHour: number) => Math.max(1, Math.round(perHour * scale));

  return {
    windowMinutes,
    massRead: scaled(massReadPerHour),
    bulkExport: scaled(bulkExportPerHour),
    failedAuth: scaled(failedAuthPerHour),
    lockout,
    offHoursStart,
    offHoursEnd,
  };
}

// Window lower-bound SQL fragment shared by every query.
function windowStart(windowMinutes: number) {
  return sql`(now() - ${sql.lit(`${windowMinutes} minutes`)}::interval)`;
}

// (a) mass-read: CLINICAL_RECORD_READ per user over threshold.
async function detectMassRead(t: Thresholds): Promise<AnomalyFinding[]> {
  const rows = await sql<{ user_id: number | null; n: number }>`
    SELECT user_id, COUNT(*)::int AS n
    FROM audit_logs
    WHERE kind = 'CLINICAL_RECORD_READ'
      AND occurred_at >= ${windowStart(t.windowMinutes)}
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > ${sql.lit(t.massRead)}
  `.execute(kysely);
  return rows.rows.map((r) => ({
    kind: "mass_read" as const,
    scope: `user:${r.user_id}`,
    severity: "critical" as const,
    count: r.n,
    threshold: t.massRead,
    subject: `user:${r.user_id}`,
  }));
}

// (b) off-hours: any access (CLINICAL_RECORD_READ / DATA_EXPORT) whose local
// hour falls outside the working window [offHoursEnd, offHoursStart).
async function detectOffHours(t: Thresholds): Promise<AnomalyFinding[]> {
  const rows = await sql<{ user_id: number | null; n: number }>`
    SELECT user_id, COUNT(*)::int AS n
    FROM audit_logs
    WHERE kind IN ('CLINICAL_RECORD_READ', 'CLINICAL_DOCUMENT_VIEW', 'DATA_EXPORT')
      AND occurred_at >= ${windowStart(t.windowMinutes)}
      AND (
        EXTRACT(HOUR FROM occurred_at AT TIME ZONE ${TZ}) >= ${sql.lit(t.offHoursStart)}
        OR EXTRACT(HOUR FROM occurred_at AT TIME ZONE ${TZ}) < ${sql.lit(t.offHoursEnd)}
      )
    GROUP BY user_id
  `.execute(kysely);
  return rows.rows.map((r) => ({
    kind: "off_hours" as const,
    scope: r.user_id == null ? "global" : `user:${r.user_id}`,
    severity: "warning" as const,
    count: r.n,
    threshold: 0,
    subject: r.user_id == null ? "anonymous" : `user:${r.user_id}`,
  }));
}

// (c) bulk export: DATA_EXPORT per user over threshold.
async function detectBulkExport(t: Thresholds): Promise<AnomalyFinding[]> {
  const rows = await sql<{ user_id: number | null; n: number }>`
    SELECT user_id, COUNT(*)::int AS n
    FROM audit_logs
    WHERE kind = 'DATA_EXPORT'
      AND occurred_at >= ${windowStart(t.windowMinutes)}
    GROUP BY user_id
    HAVING COUNT(*) > ${sql.lit(t.bulkExport)}
  `.execute(kysely);
  return rows.rows.map((r) => ({
    kind: "bulk_export" as const,
    scope: r.user_id == null ? "global" : `user:${r.user_id}`,
    severity: "critical" as const,
    count: r.n,
    threshold: t.bulkExport,
    subject: r.user_id == null ? "anonymous" : `user:${r.user_id}`,
  }));
}

// (d) failed-auth spike: LOGIN_FAILURE | MFA_FAILURE per ip over threshold.
async function detectFailedAuth(t: Thresholds): Promise<AnomalyFinding[]> {
  const rows = await sql<{ ip: string | null; n: number }>`
    SELECT ip, COUNT(*)::int AS n
    FROM audit_logs
    WHERE kind IN ('LOGIN_FAILURE', 'MFA_FAILURE')
      AND occurred_at >= ${windowStart(t.windowMinutes)}
      AND ip IS NOT NULL
    GROUP BY ip
    HAVING COUNT(*) > ${sql.lit(t.failedAuth)}
  `.execute(kysely);
  return rows.rows.map((r) => ({
    kind: "failed_auth" as const,
    scope: `ip:${r.ip}`,
    severity: "critical" as const,
    count: r.n,
    threshold: t.failedAuth,
    subject: `ip:${r.ip}`,
  }));
}

// (e) lockout spike: LOGIN_LOCKED count over threshold (global).
async function detectLockoutSpike(t: Thresholds): Promise<AnomalyFinding[]> {
  const rows = await sql<{ n: number }>`
    SELECT COUNT(*)::int AS n
    FROM audit_logs
    WHERE kind = 'LOGIN_LOCKED'
      AND occurred_at >= ${windowStart(t.windowMinutes)}
  `.execute(kysely);
  const n = rows.rows[0]?.n ?? 0;
  if (n <= t.lockout) return [];
  return [
    {
      kind: "lockout_spike",
      scope: "global",
      severity: "critical",
      count: n,
      threshold: t.lockout,
      subject: "global",
    },
  ];
}

const ALERT_TITLES: Record<AnomalyKind, string> = {
  mass_read: "Lectura masiva de fichas clínicas",
  off_hours: "Acceso a datos fuera de horario",
  bulk_export: "Exportación masiva de datos",
  failed_auth: "Ráfaga de autenticaciones fallidas",
  lockout_spike: "Pico de bloqueos de cuenta",
};

export async function runAuditAnomaly(): Promise<AuditAnomalyReport> {
  const startedAt = Date.now();
  let thresholds: Thresholds;
  try {
    thresholds = await loadThresholds();
  } catch (err) {
    logWarn("[security.audit-anomaly] failed to load thresholds", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { windowMinutes: 0, findings: [], alertsEmitted: 0, durationMs: Date.now() - startedAt };
  }

  const findings: AnomalyFinding[] = [];
  try {
    const detectors = await Promise.all([
      detectMassRead(thresholds),
      detectOffHours(thresholds),
      detectBulkExport(thresholds),
      detectFailedAuth(thresholds),
      detectLockoutSpike(thresholds),
    ]);
    for (const group of detectors) findings.push(...group);
  } catch (err) {
    logWarn("[security.audit-anomaly] detection query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  let alertsEmitted = 0;
  for (const f of findings) {
    const title = ALERT_TITLES[f.kind];
    const message =
      f.kind === "off_hours"
        ? `${f.subject}: ${f.count} accesos fuera del horario [${thresholds.offHoursEnd}:00–${thresholds.offHoursStart}:00] en ${thresholds.windowMinutes} min`
        : `${f.subject}: ${f.count} eventos (umbral ${f.threshold}) en ${thresholds.windowMinutes} min`;

    const res = await emitSecurityAlert({
      scope: f.scope,
      alertType: `anomaly:${f.kind}`,
      severity: f.severity,
      title,
      message,
      details: {
        kind: f.kind,
        subject: f.subject,
        count: f.count,
        threshold: f.threshold,
        windowMinutes: thresholds.windowMinutes,
      },
      url: "/admin/security/audit",
    });
    if (res.delivered) alertsEmitted += 1;

    // Always land an AuditLog row for the anomaly (append-only, HMAC-chained),
    // independent of whether the operator push was throttled/delivered.
    await logAuditEvent({
      kind: "ADMIN_ACTION",
      actorLabel: "system:audit-anomaly",
      resource: "audit_logs",
      resourceId: f.subject,
      outcome: "denied",
      message: `anomaly ${f.kind}: ${message}`,
      metadata: { ...f, windowMinutes: thresholds.windowMinutes },
    });
  }

  const durationMs = Date.now() - startedAt;
  logEvent("[security.audit-anomaly] scan complete", {
    windowMinutes: thresholds.windowMinutes,
    findings: findings.length,
    alertsEmitted,
    durationMs,
  });

  return { windowMinutes: thresholds.windowMinutes, findings, alertsEmitted, durationMs };
}
