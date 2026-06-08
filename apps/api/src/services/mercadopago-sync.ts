import { db, kysely, type JsonValue } from "@finanzas/db";
import { sql } from "kysely";
import { logAuditEvent } from "../lib/audit-log.ts";

type NonNullJsonValue = Exclude<JsonValue, null>;

export type MpReportType = "release" | "settlement";

export type MpImportChangeInput = {
  fieldName: string;
  newValue: JsonValue | undefined;
  oldValue: JsonValue | undefined;
  reportType: MpReportType;
  sourceId: string;
  syncLogId: bigint;
};

export type MpImportChangeRow = {
  changedAt: Date;
  fieldName: string;
  id: bigint;
  newValue: JsonValue | null;
  oldValue: JsonValue | null;
  reportType: MpReportType;
  sourceId: string;
  syncLogId: bigint;
};

export async function createMpSyncLogEntry(params: {
  triggerSource: string;
  triggerLabel?: string | null;
  triggerUserId?: number | null;
}) {
  const log = await db.syncLog.create({
    data: {
      triggerSource: params.triggerSource,
      triggerUserId: params.triggerUserId ?? null,
      triggerLabel: params.triggerLabel ?? null,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
  return log.id;
}

export async function finalizeMpSyncLogEntry(
  id: bigint,
  data: {
    status: "SUCCESS" | "ERROR";
    inserted?: number;
    updated?: number;
    skipped?: number;
    excluded?: number;
    errorMessage?: string;
    changeDetails?: NonNullJsonValue;
  }
) {
  await db.syncLog.update({
    where: { id },
    data: {
      status: data.status,
      finishedAt: new Date(),
      inserted: data.inserted,
      updated: data.updated,
      skipped: data.skipped,
      excluded: data.excluded,
      errorMessage: data.errorMessage,
      changeDetails: data.changeDetails ?? undefined,
    },
  });
}

export async function listMpSyncLogs(options?: { limit?: number; offset?: number }) {
  const { limit = 50, offset = 0 } = options ?? {};
  const [logs, total] = await db.$transaction([
    db.syncLog.findMany({
      where: { triggerSource: { startsWith: "mp:" } },
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.syncLog.count({ where: { triggerSource: { startsWith: "mp:" } } }),
  ]);
  return { logs, total };
}

export async function insertMpImportChanges(changes: MpImportChangeInput[]) {
  if (changes.length === 0) {
    return 0;
  }

  // Keys MUST be snake_case to match the jsonb_to_recordset column names below
  // (it matches JSON keys to output column names case-sensitively; camelCase
  // keys silently yield NULL for every column → not-null violation on
  // sync_log_id).
  const payload = JSON.stringify(
    changes.map((change) => ({
      field_name: change.fieldName,
      new_value: change.newValue ?? null,
      old_value: change.oldValue ?? null,
      report_type: change.reportType,
      source_id: change.sourceId,
      sync_log_id: change.syncLogId.toString(),
    }))
  );

  const result = await sql<{ id: bigint }>`
    WITH input AS (
      SELECT
        sync_log_id::bigint AS sync_log_id,
        report_type,
        source_id,
        field_name,
        old_value,
        new_value
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(
        sync_log_id text,
        report_type text,
        source_id text,
        field_name text,
        old_value jsonb,
        new_value jsonb
      )
    )
    INSERT INTO mercadopago_import_changes (
      sync_log_id,
      report_type,
      source_id,
      field_name,
      old_value,
      new_value
    )
    SELECT
      sync_log_id,
      report_type,
      source_id,
      field_name,
      old_value,
      new_value
    FROM input
    RETURNING id
  `.execute(kysely);

  return result.rows.length;
}

export async function listMpImportChanges(options: {
  fieldName?: string;
  limit?: number;
  offset?: number;
  sourceId?: string;
  syncLogId: bigint;
}) {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const conditions = [sql`sync_log_id = ${options.syncLogId}`];

  if (options.sourceId?.trim()) {
    conditions.push(sql`source_id ILIKE ${`%${options.sourceId.trim()}%`}`);
  }
  if (options.fieldName?.trim()) {
    conditions.push(sql`field_name = ${options.fieldName.trim()}`);
  }

  const where = sql.join(conditions, sql` AND `);
  const [changesResult, countResult] = await Promise.all([
    sql<MpImportChangeRow>`
      SELECT
        id,
        sync_log_id AS "syncLogId",
        report_type AS "reportType",
        source_id AS "sourceId",
        field_name AS "fieldName",
        old_value AS "oldValue",
        new_value AS "newValue",
        changed_at AS "changedAt"
      FROM mercadopago_import_changes
      WHERE ${where}
      ORDER BY changed_at DESC, id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `.execute(kysely),
    sql<{ total: number }>`
      SELECT COUNT(*)::int AS total
      FROM mercadopago_import_changes
      WHERE ${where}
    `.execute(kysely),
  ]);

  return {
    changes: changesResult.rows.map((row) => ({
      ...row,
      id: BigInt(row.id),
      syncLogId: BigInt(row.syncLogId),
    })),
    total: countResult.rows[0]?.total ?? 0,
  };
}

export async function logMpImportAuditEvent(params: {
  changeCount: number;
  fileName?: string | null;
  reportType: MpReportType;
  stats: {
    insertedRows: number;
    skippedRows: number;
    totalRows: number;
    unchangedRows: number;
    updatedRows: number;
    validRows: number;
  };
  syncLogId: bigint;
  triggerSource: string;
  userId?: number | null;
}) {
  await logAuditEvent({
    kind: "IMPORT_UPSERT",
    message: `MercadoPago ${params.reportType}: ${params.stats.updatedRows} fila(s) actualizada(s), ${params.changeCount} cambio(s) de campo`,
    metadata: {
      changeCount: params.changeCount,
      fileName: params.fileName ?? null,
      reportType: params.reportType,
      stats: params.stats,
      syncLogId: params.syncLogId.toString(),
      triggerSource: params.triggerSource,
    },
    outcome: "ok",
    resource: "MercadoPagoReport",
    resourceId: params.syncLogId.toString(),
    userId: params.userId ?? null,
  });
}
