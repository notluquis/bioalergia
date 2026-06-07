import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import {
  cancelJob,
  completeJob,
  failJob,
  getActiveJobsByType,
  isJobCancelled,
  startJob,
  updateJobProgress,
} from "../lib/jobQueue.ts";
import { downloadOneDriveItem } from "../lib/microsoft/onedrive.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { persistXlsxFileSnapshot } from "./xlsx-snapshot.ts";

// Shared "Archivar XLSX" pipeline. Walks the OneDrive xlsx library
// (clinical_xlsx_files), downloads each file once and stores its first-sheet
// snapshot on the row. Both features (tests cutáneos, fichas) trigger this same
// job filtered by classification, so every OneDrive consumer goes through the
// shared snapshot store instead of re-downloading at parse time.

const JOB_TYPE = "onedrive-archive-snapshots";
const FETCH_BATCH = 200;
const DEFAULT_CONCURRENCY = 6;
const MAX_CONCURRENCY = 10;

export function getOneDriveArchiveJobType(): string {
  return JOB_TYPE;
}

function resolveConcurrency(): number {
  const raw = Number.parseInt(process.env.ONEDRIVE_ARCHIVE_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_CONCURRENCY;
  return Math.min(raw, MAX_CONCURRENCY);
}

export type ArchiveXlsxOptions = {
  classification?: "SKIN_TEST" | "CLINICAL_DOCUMENT" | "OTHER";
  accountId?: string;
  /** Re-archive even rows that already have a snapshot (default: only missing/stale). */
  force?: boolean;
  trigger?: string;
};

type LibCursor = { createdAt: Date; id: string } | null;

function whereClause(opts: ArchiveXlsxOptions) {
  const parts = [
    sql`onedrive_item_id IS NOT NULL`,
    opts.classification
      ? sql`classification = ${opts.classification}::"ClinicalXlsxFileClassification"`
      : null,
    opts.accountId ? sql`onedrive_account_id = ${opts.accountId}` : null,
    // Missing snapshot, or stale (file tags moved past the archived ones).
    opts.force
      ? null
      : sql`(snapshot_status IS DISTINCT FROM 'ARCHIVED'
             OR snapshot_etag IS DISTINCT FROM onedrive_etag
             OR snapshot_ctag IS DISTINCT FROM onedrive_ctag)`,
  ].filter(Boolean) as ReturnType<typeof sql>[];
  return sql.join(parts, sql` AND `);
}

async function countLibrary(opts: ArchiveXlsxOptions): Promise<number> {
  const r = await sql<{ c: string }>`
    SELECT COUNT(*)::text AS c FROM clinical_xlsx_files WHERE ${whereClause(opts)}
  `.execute(kysely);
  return Number.parseInt(r.rows[0]?.c ?? "0", 10);
}

type LibRow = {
  id: string;
  createdAt: Date;
  accountId: string | null;
  driveId: string | null;
  itemId: string;
  etag: string | null;
  ctag: string | null;
};

async function fetchLibraryBatch(
  opts: ArchiveXlsxOptions,
  limit: number,
  after: LibCursor
): Promise<LibRow[]> {
  const rows = await sql<{
    id: string;
    created_at: Date;
    onedrive_account_id: string | null;
    onedrive_drive_id: string | null;
    onedrive_item_id: string;
    onedrive_etag: string | null;
    onedrive_ctag: string | null;
  }>`
    SELECT id, created_at, onedrive_account_id, onedrive_drive_id, onedrive_item_id,
           onedrive_etag, onedrive_ctag
    FROM clinical_xlsx_files
    WHERE ${whereClause(opts)}
      ${after ? sql`AND (created_at, id) > (${after.createdAt}::timestamptz, ${after.id})` : sql``}
    ORDER BY created_at ASC, id ASC
    LIMIT ${limit}
  `.execute(kysely);
  return rows.rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    accountId: r.onedrive_account_id,
    driveId: r.onedrive_drive_id,
    itemId: r.onedrive_item_id,
    etag: r.onedrive_etag,
    ctag: r.onedrive_ctag,
  }));
}

// Background archive job: one in-flight at a time, keyset + worker pool, the
// slow OneDrive download parallelized. Cancellable + progress-reporting.
export function startArchiveXlsxSnapshotsJob(options: ArchiveXlsxOptions = {}): string {
  const active = getActiveJobsByType(JOB_TYPE);
  if (active.length > 0) return active[0].id;

  const jobId = startJob(JOB_TYPE, 1);
  updateJobProgress(jobId, 0, "Preparando archivado de snapshots", { phase: "starting" });

  void (async () => {
    try {
      const total = await countLibrary(options);
      if (total === 0) {
        completeJob(jobId, { processed: 0, archived: 0, errors: 0 }, "Sin archivos por archivar", {
          phase: "completed",
        });
        return;
      }
      const concurrency = resolveConcurrency();
      updateJobProgress(jobId, 0, `Archivando ${total} XLSX`, { phase: "running", concurrency }, total);

      let processed = 0;
      let archived = 0;
      let errors = 0;
      let cursor: LibCursor = null;

      while (processed < total) {
        if (isJobCancelled(jobId)) throw new Error("SYNC_CANCELLED");
        const batch = await fetchLibraryBatch(options, FETCH_BATCH, cursor);
        if (batch.length === 0) break;
        const last = batch[batch.length - 1];
        cursor = { createdAt: last.createdAt, id: last.id };

        let idx = 0;
        const worker = async () => {
          while (idx < batch.length) {
            if (isJobCancelled(jobId)) throw new Error("SYNC_CANCELLED");
            const row = batch[idx++];
            try {
              const buffer = await downloadOneDriveItem(
                row.accountId ?? "",
                row.itemId,
                row.driveId ?? undefined
              );
              await persistXlsxFileSnapshot(row.id, buffer, { etag: row.etag, ctag: row.ctag });
              archived += 1;
            } catch (err) {
              errors += 1;
              const msg = err instanceof Error ? err.message : String(err);
              await sql`
                UPDATE clinical_xlsx_files
                SET snapshot_status = 'ERROR', snapshot_error = ${msg}, updated_at = now()
                WHERE id = ${row.id}
              `.execute(kysely);
            }
            processed += 1;
            if (processed % 25 === 0 || processed === total) {
              updateJobProgress(
                jobId,
                processed,
                `Archivando XLSX (${processed}/${total})`,
                { phase: "running", archived, errors, concurrency },
                total
              );
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
      }

      completeJob(
        jobId,
        { processed, archived, errors },
        `Archivado completado — ${archived} snapshots, ${errors} errores`,
        { phase: "completed", archived, errors }
      );
      logEvent("onedrive.archive.completed", {
        processed,
        archived,
        errors,
        classification: options.classification ?? "ALL",
        trigger: options.trigger ?? "manual",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "SYNC_CANCELLED") {
        cancelJob(jobId, "Archivado cancelado por usuario");
        return;
      }
      failJob(jobId, message);
      logError("onedrive.archive.failed", error, { trigger: options.trigger ?? "manual" });
    }
  })();

  return jobId;
}
