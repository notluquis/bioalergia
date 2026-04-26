import { kysely } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { isSkinTestCandidateFilename } from "../lib/skin-test-file-filter";
import {
  downloadOneDriveItem,
  getOneDriveStatus,
  listOneDriveDeltaItems,
  type OneDriveItem,
} from "../lib/microsoft/onedrive";
import {
  parseSkinTestWorkbookBuffer,
  SKIN_TEST_PARSER_VERSION,
  type ParsedSkinTestInterpretation,
  type ParsedSkinTestResult,
  type ParsedSkinTestWorkbook,
  type SkinTestIssue,
} from "./clinical-skin-test-parser";

const AUTO_IMPORT_MIN_CONFIDENCE = 80;
const JOB_TYPE = "clinical-skin-test-import-sync";
const DEFAULT_SYNC_CONCURRENCY = 3;
const MAX_SYNC_CONCURRENCY = 8;

export type SkinTestSyncProgressPhase =
  | "completed"
  | "delta"
  | "processing"
  | "scanned"
  | "starting";

export interface SkinTestSyncProgress {
  accountEmail?: string;
  accountId?: string;
  accountIndex?: number;
  accountsTotal?: number;
  discovered?: number;
  documents?: number;
  documentsMatched?: number;
  documentsUnmatched?: number;
  elapsedSeconds?: number;
  errors?: number;
  etaSeconds?: number | null;
  filename?: string;
  imported?: number;
  page?: number;
  pending?: number;
  phase: SkinTestSyncProgressPhase;
  processed: number;
  scanned?: number;
  skipped?: number;
  total: number;
  unchanged?: number;
  xlsx?: number;
}

export interface SkinTestImportListInput {
  confidenceMax?: number;
  confidenceMin?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  status?: SkinTestImportStatus;
}

export type SkinTestImportStatus =
  | "DISCOVERED"
  | "ERROR"
  | "IMPORTED"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "SKIPPED";

export interface SkinTestImportOutput {
  accountEmail: null | string;
  accountName: null | string;
  confidence: number;
  error: null | string;
  filename: string;
  id: string;
  importedAt: null | string;
  issues: SkinTestIssue[];
  modifiedAt: null | string;
  oneDriveAccountId: null | string;
  oneDriveWebUrl: null | string;
  parsedPayload: null | ParsedPayload;
  path: null | string;
  reviewedAt: null | string;
  reviewNotes: null | string;
  skinTestId?: null | string;
  matchedSeriesId?: null | number;
  status: SkinTestImportStatus;
  syncAction?: "PROCESSED" | "SKIPPED_UNCHANGED";
  updatedAt: string;
}

export interface ParsedPayload {
  header: ParsedSkinTestWorkbook["header"];
  interpretation?: ParsedSkinTestWorkbook["interpretation"];
  results: ParsedSkinTestResult[];
}

export interface SkinTestDetailOutput {
  ageLabel: null | string;
  address: null | string;
  clinicalNote: null | string;
  clinicalSeriesId: number;
  id: string;
  nonConclusiveDueToHyperreactivity: boolean;
  oneDriveWebUrl: null | string;
  panelTitle: null | string;
  patientEmail: null | string;
  patientName: null | string;
  patientPhone: null | string;
  patientRut: null | string;
  physicianName: null | string;
  physicianSpecialty: null | string;
  resultHash: null | string;
  results: ParsedSkinTestResult[];
  sourceImportId: string;
  testDate: string;
  website: null | string;
}

export interface ClinicalDocumentImportOutput {
  accountEmail: null | string;
  accountName: null | string;
  clinicalSeriesId: null | number;
  documentKind: ClinicalDocumentImportKind;
  extractedPatientName: null | string;
  filename: string;
  id: string;
  importedAt: null | string;
  issues: SkinTestIssue[];
  modifiedAt: null | string;
  oneDriveAccountId: null | string;
  oneDriveWebUrl: null | string;
  path: null | string;
  size: null | number;
  status: ClinicalDocumentImportStatus;
  updatedAt: string;
}

interface ImportRow {
  accountEmail?: null | string;
  accountName?: null | string;
  confidence: number;
  error: null | string;
  filename: string;
  id: string;
  importedAt: Date | null;
  issues: unknown;
  modifiedAt: Date | null;
  oneDriveAccountId?: null | string;
  oneDriveWebUrl: null | string;
  parsedPayload: unknown;
  path: null | string;
  reviewedAt: Date | null;
  reviewNotes: null | string;
  skinTestId?: null | string;
  matchedSeriesId?: null | number;
  status: SkinTestImportStatus;
  updatedAt: Date;
}

interface MatchResult {
  issues: SkinTestIssue[];
  seriesId: null | number;
}

type ClinicalDocumentImportKind = "CLINICAL_RECORD" | "OTHER" | "VISIT_SHEET";
type ClinicalDocumentImportStatus = "DISCOVERED" | "MATCHED" | "REJECTED" | "SKIPPED" | "UNMATCHED";

interface ClinicalSeriesNameEntry {
  id: number;
  name: string;
  normalizedName: string;
}

interface ClinicalDocumentSeriesMatch {
  issue?: SkinTestIssue;
  seriesId: null | number;
}

let clinicalSeriesNameCache: ClinicalSeriesNameEntry[] | null = null;

export function getSkinTestImportJobType() {
  return JOB_TYPE;
}

export async function syncClinicalSkinTestImports(options?: {
  accountId?: string;
  folderDriveId?: null | string;
  folderItemId?: null | string;
  folderPath?: string;
  force?: boolean;
  onProgress?: (progress: SkinTestSyncProgress & { message: string }) => void;
  shouldCancel?: () => boolean;
}) {
  const status = await getOneDriveStatus();
  if (!status.connected) {
    throw new Error("OneDrive no conectado.");
  }

  const accounts = status.accounts.filter(
    (item) => !options?.accountId || item.accountId === options.accountId
  );
  if (accounts.length === 0) {
    throw new Error("No hay cuentas OneDrive para sincronizar con esos filtros.");
  }

  const concurrency = resolveSyncConcurrency();

  let imported = 0;
  let pending = 0;
  let processed = 0;
  let skipped = 0;
  let unchanged = 0;
  let errors = 0;
  let discovered = 0;
  let documents = 0;
  let documentsMatched = 0;
  let documentsUnmatched = 0;
  let scanned = 0;
  let xlsx = 0;
  const workItems: Array<{ account: (typeof accounts)[number]; item: OneDriveItem }> = [];
  const documentWorkItems: Array<{ account: (typeof accounts)[number]; item: OneDriveItem }> = [];

  const emit = (message: string, progress: SkinTestSyncProgress) => {
    options?.onProgress?.({ ...progress, message });
  };

  emit(`Preparando ${accounts.length} cuenta(s) OneDrive`, {
    accountsTotal: accounts.length,
    phase: "starting",
    processed: 0,
    scanned,
    total: accounts.length,
    xlsx,
    documents,
    documentsMatched,
    documentsUnmatched,
  });

  for (const [accountIndex, account] of accounts.entries()) {
    if (options?.shouldCancel?.()) {
      throw new Error("SYNC_CANCELLED");
    }

    emit(`[${account.email}] Consultando cambios en OneDrive`, {
      accountEmail: account.email,
      accountId: account.accountId,
      accountIndex: accountIndex + 1,
      accountsTotal: accounts.length,
      phase: "delta",
      processed: accountIndex,
      scanned,
      total: accounts.length,
      xlsx,
    });

    const { items } = await listOneDriveDeltaItems(account.accountId, {
      folderDriveId: options?.folderDriveId,
      folderItemId: options?.folderItemId,
      folderPath: options?.folderPath,
      force: options?.force,
      onPage: ({ itemsSoFar, page }) => {
        emit(`[${account.email}] Leyendo cambios: página ${page}, ${itemsSoFar} item(s)`, {
          accountEmail: account.email,
          accountId: account.accountId,
          accountIndex: accountIndex + 1,
          accountsTotal: accounts.length,
          page,
          phase: "delta",
          processed: accountIndex,
          scanned: scanned + itemsSoFar,
          total: accounts.length,
          xlsx,
          documents,
          documentsMatched,
          documentsUnmatched,
        });
      },
    });
    const xlsxItems = items.filter(isRelevantXlsx);
    const skinTestItems = xlsxItems.filter(isImportableXlsx);
    const clinicalDocumentItems = xlsxItems.filter((item) => !isImportableXlsx(item));
    scanned += items.length;
    xlsx += xlsxItems.length;
    workItems.push(...skinTestItems.map((item) => ({ account, item })));
    documentWorkItems.push(...clinicalDocumentItems.map((item) => ({ account, item })));

    emit(
      `[${account.email}] ${items.length} cambio(s), ${skinTestItems.length} test(s), ${clinicalDocumentItems.length} documento(s)`,
      {
        accountEmail: account.email,
        accountId: account.accountId,
        accountIndex: accountIndex + 1,
        accountsTotal: accounts.length,
        documents,
        documentsMatched,
        documentsUnmatched,
        phase: "scanned",
        processed: accountIndex + 1,
        scanned,
        total: accounts.length,
        xlsx,
      }
    );
  }

  const totalWorkItems = workItems.length + documentWorkItems.length;
  if (totalWorkItems === 0) {
    emit(`Sync terminado: ${scanned} item(s) revisado(s), sin .xlsx relevante(s)`, {
      accountsTotal: accounts.length,
      errors,
      discovered,
      documents,
      documentsMatched,
      documentsUnmatched,
      imported,
      pending,
      phase: "completed",
      processed: accounts.length,
      scanned,
      skipped,
      total: accounts.length,
      unchanged,
      xlsx,
    });
    return {
      discovered,
      documents,
      documentsMatched,
      documentsUnmatched,
      errors,
      imported,
      pending,
      scanned,
      skipped,
      unchanged,
      xlsx,
    };
  }

  let cursor = 0;
  let documentCursor = 0;
  const workerCount = Math.min(concurrency, Math.max(workItems.length, documentWorkItems.length));

  emit(`Registrando ${workItems.length} test(s) y ${documentWorkItems.length} documento(s)`, {
    accountsTotal: accounts.length,
    documents,
    documentsMatched,
    documentsUnmatched,
    phase: "processing",
    processed,
    scanned,
    total: totalWorkItems,
    xlsx,
  });

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      if (options?.shouldCancel?.()) {
        throw new Error("SYNC_CANCELLED");
      }

      const index = cursor;
      if (index >= workItems.length) {
        return;
      }
      cursor += 1;

      const { account, item } = workItems[index];
      emit(`[${account.email}] Registrando ${item.name}`, {
        accountEmail: account.email,
        accountId: account.accountId,
        accountsTotal: accounts.length,
        errors,
        filename: item.name,
        imported,
        pending,
        documents,
        documentsMatched,
        documentsUnmatched,
        phase: "processing",
        processed,
        scanned,
        skipped,
        total: totalWorkItems,
        unchanged,
        xlsx,
      });

      const result = await discoverOneDriveSkinTestItem(account.accountId, item, {
        force: options?.force,
      });

      if (result.syncAction === "SKIPPED_UNCHANGED") unchanged += 1;
      else if (result.status === "DISCOVERED") discovered += 1;
      else if (result.status === "IMPORTED") imported += 1;
      else if (result.status === "PENDING_REVIEW") pending += 1;
      else if (result.status === "ERROR") errors += 1;
      else skipped += 1;

      processed += 1;
      emit(
        `[${account.email}] ${item.name}: ${result.syncAction === "SKIPPED_UNCHANGED" ? "sin cambios" : result.status}`,
        {
          accountEmail: account.email,
          accountId: account.accountId,
          accountsTotal: accounts.length,
          errors,
          discovered,
          filename: item.name,
          imported,
          pending,
          documents,
          documentsMatched,
          documentsUnmatched,
          phase: "processing",
          processed,
          scanned,
          skipped,
          total: totalWorkItems,
          unchanged,
          xlsx,
        }
      );
    }
  });

  await Promise.all(workers);

  const documentWorkers = Array.from(
    { length: Math.min(concurrency, documentWorkItems.length) },
    async () => {
      while (true) {
        if (options?.shouldCancel?.()) {
          throw new Error("SYNC_CANCELLED");
        }
        const index = documentCursor;
        if (index >= documentWorkItems.length) return;
        documentCursor += 1;

        const { account, item } = documentWorkItems[index];
        const result = await discoverOneDriveClinicalDocument(account.accountId, item);
        if (result.status === "MATCHED") documentsMatched += 1;
        else documentsUnmatched += 1;
        documents += 1;
        processed += 1;

        emit(`[${account.email}] Documento: ${item.name} (${result.status})`, {
          accountEmail: account.email,
          accountId: account.accountId,
          accountsTotal: accounts.length,
          discovered,
          documents,
          documentsMatched,
          documentsUnmatched,
          errors,
          filename: item.name,
          imported,
          pending,
          phase: "processing",
          processed,
          scanned,
          skipped,
          total: totalWorkItems,
          unchanged,
          xlsx,
        });
      }
    }
  );

  await Promise.all(documentWorkers);

  emit(
    `Sync terminado: ${discovered} test(s) descubierto(s), ${documents} documento(s), ${unchanged} sin cambios, ${errors} error(es)`,
    {
      accountsTotal: accounts.length,
      errors,
      discovered,
      documents,
      documentsMatched,
      documentsUnmatched,
      imported,
      pending,
      phase: "completed",
      processed,
      scanned,
      skipped,
      total: totalWorkItems,
      unchanged,
      xlsx,
    }
  );

  return {
    discovered,
    documents,
    documentsMatched,
    documentsUnmatched,
    errors,
    imported,
    pending,
    scanned,
    skipped,
    unchanged,
    xlsx,
  };
}

function resolveSyncConcurrency(): number {
  const raw = Number.parseInt(process.env.SKIN_TEST_IMPORT_SYNC_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_SYNC_CONCURRENCY;
  }
  return Math.min(Math.max(raw, 1), MAX_SYNC_CONCURRENCY);
}

export async function processOneDriveSkinTestItem(
  accountId: string,
  item: OneDriveItem,
  options?: { force?: boolean }
): Promise<SkinTestImportOutput> {
  const driveId = item.parentReference?.driveId ?? "unknown";
  const existing = await getImportByOneDriveItemId(accountId, driveId, item.id);
  if (
    existing &&
    !options?.force &&
    existing.status !== "ERROR" &&
    existing.status !== "PENDING_REVIEW" &&
    existing.oneDriveETag === item.eTag &&
    existing.oneDriveCTag === item.cTag
  ) {
    return {
      ...toImportOutput(existing),
      syncAction: "SKIPPED_UNCHANGED",
    };
  }

  const importId = existing?.id ?? createId();
  const metadata = buildOneDriveItemMetadata(item, driveId);

  try {
    const buffer = await downloadOneDriveItem(accountId, item.id, driveId);
    const parsed = await parseSkinTestWorkbookBuffer(
      buffer as unknown as Parameters<typeof parseSkinTestWorkbookBuffer>[0]
    );
    const resultHash = computeResultHash(parsed.results);
    const duplicate = await findDuplicateSkinTest(importId, parsed, resultHash);

    if (duplicate.kind === "exact") {
      const allIssues = [...parsed.issues, duplicate.issue];
      await upsertImport({
        accountId,
        confidence: computeConfidence(parsed.confidence, allIssues),
        duplicateOfImportId: duplicate.sourceImportId,
        error: null,
        id: importId,
        issues: allIssues,
        metadata,
        parsedPayload: {
          header: parsed.header,
          interpretation: parsed.interpretation,
          results: parsed.results,
        },
        resultHash,
        status: "SKIPPED",
      });
      return await getSkinTestImport(importId);
    }

    const materialization = await maybeMaterializeImport(importId, parsed);
    const allIssues = [
      ...parsed.issues,
      ...materialization.issues,
      ...(duplicate.kind === "probable" ? [duplicate.issue] : []),
    ];
    const status =
      materialization.seriesId && canAutoImport(parsed, allIssues) ? "IMPORTED" : "PENDING_REVIEW";

    await upsertImport({
      accountId,
      confidence: computeConfidence(parsed.confidence, allIssues),
      duplicateOfImportId: duplicate.kind === "probable" ? duplicate.sourceImportId : null,
      error: null,
      id: importId,
      issues: allIssues,
      metadata,
      parsedPayload: {
        header: parsed.header,
        interpretation: parsed.interpretation,
        results: parsed.results,
      },
      resultHash,
      status,
    });

    if (status === "IMPORTED" && materialization.seriesId) {
      await writeSkinTest(importId, materialization.seriesId, parsed);
      await markImported(importId);
    }

    return await getSkinTestImport(importId);
  } catch (error) {
    await upsertImport({
      accountId,
      confidence: 0,
      error: error instanceof Error ? error.message : String(error),
      id: importId,
      issues: [
        {
          code: "parser_error",
          message: error instanceof Error ? error.message : String(error),
          severity: "error",
        },
      ],
      metadata,
      parsedPayload: null,
      resultHash: null,
      status: "ERROR",
    });
    return await getSkinTestImport(importId);
  }
}

async function discoverOneDriveClinicalDocument(
  accountId: string,
  item: OneDriveItem
): Promise<{
  clinicalSeriesId: null | number;
  documentKind: ClinicalDocumentImportKind;
  extractedPatientName: null | string;
  id: string;
  status: ClinicalDocumentImportStatus;
}> {
  const driveId = item.parentReference?.driveId ?? "unknown";
  const metadata = buildOneDriveItemMetadata(item, driveId);
  const existing = await getClinicalDocumentImportByOneDriveItemId(accountId, driveId, item.id);
  const importId = existing?.id ?? createId();
  const documentKind = classifyClinicalDocumentFilename(item.name);
  const extractedPatientName = extractPatientNameFromDocumentFilename(item.name);
  const match = extractedPatientName
    ? await matchClinicalSeriesByPatientName(extractedPatientName)
    : { seriesId: null };
  const clinicalSeriesId = match.seriesId;
  const issues = match.issue
    ? [match.issue]
    : clinicalSeriesId || !extractedPatientName
      ? []
      : [
          {
            code: "clinical_series_not_matched",
            message: "No se encontró serie clínica probable por nombre de archivo.",
            severity: "warning",
          },
        ];
  const status: ClinicalDocumentImportStatus = clinicalSeriesId ? "MATCHED" : "UNMATCHED";

  await sql`
    INSERT INTO clinical_document_imports (
      id,
      onedrive_account_id,
      onedrive_item_id,
      onedrive_drive_id,
      onedrive_etag,
      onedrive_ctag,
      onedrive_web_url,
      path,
      filename,
      mime_type,
      size,
      modified_at,
      document_kind,
      status,
      extracted_patient_name,
      clinical_series_id,
      error,
      issues,
      imported_at,
      created_at,
      updated_at
    )
    VALUES (
      ${importId},
      ${accountId},
      ${metadata.id},
      ${metadata.driveId},
      ${metadata.eTag},
      ${metadata.cTag},
      ${metadata.webUrl},
      ${metadata.path},
      ${metadata.filename},
      ${metadata.mimeType},
      ${metadata.size},
      ${metadata.modifiedAt}::timestamptz,
      ${documentKind}::"ClinicalDocumentImportKind",
      ${status}::"ClinicalDocumentImportStatus",
      ${extractedPatientName},
      ${clinicalSeriesId},
      null,
      ${JSON.stringify(issues)}::jsonb,
      now(),
      now(),
      now()
    )
    ON CONFLICT (onedrive_account_id, onedrive_drive_id, onedrive_item_id)
    DO UPDATE SET
      onedrive_etag = EXCLUDED.onedrive_etag,
      onedrive_ctag = EXCLUDED.onedrive_ctag,
      onedrive_web_url = EXCLUDED.onedrive_web_url,
      path = EXCLUDED.path,
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      modified_at = EXCLUDED.modified_at,
      document_kind = EXCLUDED.document_kind,
      status = EXCLUDED.status,
      extracted_patient_name = EXCLUDED.extracted_patient_name,
      clinical_series_id = EXCLUDED.clinical_series_id,
      error = null,
      issues = EXCLUDED.issues,
      imported_at = coalesce(clinical_document_imports.imported_at, now()),
      updated_at = now()
  `.execute(kysely);

  return { clinicalSeriesId, documentKind, extractedPatientName, id: importId, status };
}

async function discoverOneDriveSkinTestItem(
  accountId: string,
  item: OneDriveItem,
  options?: { force?: boolean }
): Promise<SkinTestImportOutput> {
  const driveId = item.parentReference?.driveId ?? "unknown";
  const existing = await getImportByOneDriveItemId(accountId, driveId, item.id);
  if (
    existing &&
    !options?.force &&
    existing.oneDriveETag === item.eTag &&
    existing.oneDriveCTag === item.cTag
  ) {
    return {
      ...toImportOutput(existing),
      syncAction: "SKIPPED_UNCHANGED",
    };
  }

  const importId = existing?.id ?? createId();
  const metadata = buildOneDriveItemMetadata(item, driveId);
  if (existing) {
    await sql`
      UPDATE clinical_skin_test_imports
      SET onedrive_etag = ${metadata.eTag},
          onedrive_ctag = ${metadata.cTag},
          onedrive_web_url = ${metadata.webUrl},
          path = ${metadata.path},
          filename = ${metadata.filename},
          mime_type = ${metadata.mimeType},
          size = ${metadata.size},
          modified_at = ${metadata.modifiedAt}::timestamptz,
          updated_at = now()
      WHERE id = ${importId}
    `.execute(kysely);
    return await getSkinTestImport(importId);
  }

  await upsertImport({
    accountId,
    confidence: 0,
    duplicateOfImportId: null,
    error: null,
    id: importId,
    issues: [],
    metadata,
    parsedPayload: null,
    resultHash: null,
    status: "DISCOVERED",
  });
  return await getSkinTestImport(importId);
}

function buildOneDriveItemMetadata(item: OneDriveItem, driveId: string) {
  return {
    cTag: item.cTag ?? null,
    driveId,
    eTag: item.eTag ?? null,
    filename: item.name,
    id: item.id,
    mimeType: item.file?.mimeType ?? null,
    modifiedAt: item.lastModifiedDateTime ?? null,
    path: item.parentReference?.path ?? null,
    size: item.size ?? null,
    webUrl: item.webUrl ?? null,
  };
}

export async function listSkinTestImports(input: SkinTestImportListInput = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const whereSql = buildImportWhereSql(input);
  const [itemsResult, countResult] = await Promise.all([
    sql<ImportRow>`
      SELECT
        i.id,
        i.onedrive_account_id AS "oneDriveAccountId",
        a.email AS "accountEmail",
        a.name AS "accountName",
        i.filename,
        i.path,
        i.status,
        i.confidence,
        i.error,
        i.issues,
        i.parsed_payload AS "parsedPayload",
        i.modified_at AS "modifiedAt",
        i.onedrive_web_url AS "oneDriveWebUrl",
        i.reviewed_at AS "reviewedAt",
        i.review_notes AS "reviewNotes",
        i.imported_at AS "importedAt",
        i.updated_at AS "updatedAt",
        t.id AS "skinTestId",
        t.clinical_series_id AS "matchedSeriesId"
      FROM clinical_skin_test_imports i
      LEFT JOIN onedrive_accounts a ON a.account_id = i.onedrive_account_id
      LEFT JOIN clinical_skin_tests t ON t.source_import_id = i.id
      WHERE ${whereSql}
      ORDER BY i.updated_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `.execute(kysely),
    sql<{ count: number }>`
      SELECT count(*)::int AS count
      FROM clinical_skin_test_imports i
      WHERE ${whereSql}
    `.execute(kysely),
  ]);
  return {
    items: itemsResult.rows.map(toImportOutput),
    page,
    pageSize,
    total: countResult.rows[0]?.count ?? 0,
  };
}

export async function getSkinTestImport(id: string): Promise<SkinTestImportOutput> {
  const result = await sql<ImportRow>`
    SELECT
      i.id,
      i.onedrive_account_id AS "oneDriveAccountId",
      a.email AS "accountEmail",
      a.name AS "accountName",
      i.filename,
      i.path,
      i.status,
      i.confidence,
      i.error,
      i.issues,
      i.parsed_payload AS "parsedPayload",
      i.modified_at AS "modifiedAt",
      i.onedrive_web_url AS "oneDriveWebUrl",
      i.reviewed_at AS "reviewedAt",
      i.review_notes AS "reviewNotes",
      i.imported_at AS "importedAt",
      i.updated_at AS "updatedAt",
      t.id AS "skinTestId",
      t.clinical_series_id AS "matchedSeriesId"
    FROM clinical_skin_test_imports i
    LEFT JOIN onedrive_accounts a ON a.account_id = i.onedrive_account_id
    LEFT JOIN clinical_skin_tests t ON t.source_import_id = i.id
    WHERE i.id = ${id}
  `.execute(kysely);
  const row = result.rows[0];
  if (!row) throw new Error("Import no encontrado.");
  return toImportOutput(row);
}

export async function approveSkinTestImport(id: string, userId: number, notes?: string) {
  const parsed = await getStoredParsedPayload(id);
  const match = await matchOrCreateClinicalSeries(parsed, { allowCreate: true });
  if (!match.seriesId) {
    throw new Error(match.issues[0]?.message ?? "No se pudo resolver la serie clínica.");
  }
  await writeSkinTest(id, match.seriesId, {
    header: parsed.header,
    interpretation: parsed.interpretation ?? emptyInterpretation(),
    results: parsed.results,
  });
  await sql`
    UPDATE clinical_skin_test_imports
    SET status = 'IMPORTED',
        reviewed_by = ${userId},
        reviewed_at = now(),
        review_notes = ${notes ?? null},
        imported_at = now(),
        updated_at = now()
    WHERE id = ${id}
  `.execute(kysely);
  return await getSkinTestImport(id);
}

export async function rejectSkinTestImport(id: string, userId: number, notes?: string) {
  await sql`
    UPDATE clinical_skin_test_imports
    SET status = 'REJECTED',
        reviewed_by = ${userId},
        reviewed_at = now(),
        review_notes = ${notes ?? null},
        updated_at = now()
    WHERE id = ${id}
  `.execute(kysely);
  return await getSkinTestImport(id);
}

export async function reprocessSkinTestImport(id: string) {
  const result = await sql<{
    oneDriveDriveId: string | null;
    oneDriveItemId: string;
    oneDriveAccountId: string | null;
  }>`
    SELECT
      onedrive_drive_id AS "oneDriveDriveId",
      onedrive_item_id AS "oneDriveItemId",
      onedrive_account_id AS "oneDriveAccountId"
    FROM clinical_skin_test_imports
    WHERE id = ${id}
  `.execute(kysely);
  const driveId = result.rows[0]?.oneDriveDriveId;
  const itemId = result.rows[0]?.oneDriveItemId;
  let accountId = result.rows[0]?.oneDriveAccountId;

  if (!itemId) throw new Error("Import no encontrado.");

  // Fallback for old records without accountId
  if (!accountId) {
    const status = await getOneDriveStatus();
    if (status.accounts.length === 0) throw new Error("OneDrive no conectado.");
    accountId = status.accounts[0]?.accountId;
  }

  if (!accountId) throw new Error("No hay cuenta de OneDrive para re-procesar.");

  const buffer = await downloadOneDriveItem(accountId, itemId, driveId);
  const parsed = await parseSkinTestWorkbookBuffer(
    buffer as unknown as Parameters<typeof parseSkinTestWorkbookBuffer>[0]
  );
  const resultHash = computeResultHash(parsed.results);
  const duplicate = await findDuplicateSkinTest(id, parsed, resultHash);
  if (duplicate.kind === "exact") {
    const allIssues = [...parsed.issues, duplicate.issue];
    await sql`
      UPDATE clinical_skin_test_imports
      SET parser_version = ${SKIN_TEST_PARSER_VERSION},
          status = 'SKIPPED',
          confidence = ${computeConfidence(parsed.confidence, allIssues)},
          error = null,
          issues = ${JSON.stringify(allIssues)}::jsonb,
          parsed_payload = ${JSON.stringify({ header: parsed.header, interpretation: parsed.interpretation, results: parsed.results })}::jsonb,
          result_hash = ${resultHash},
          duplicate_of_import_id = ${duplicate.sourceImportId},
          updated_at = now()
      WHERE id = ${id}
    `.execute(kysely);
    return await getSkinTestImport(id);
  }
  const materialization = await maybeMaterializeImport(id, parsed);
  const allIssues = [
    ...parsed.issues,
    ...materialization.issues,
    ...(duplicate.kind === "probable" ? [duplicate.issue] : []),
  ];
  await sql`
    UPDATE clinical_skin_test_imports
    SET parser_version = ${SKIN_TEST_PARSER_VERSION},
        status = ${materialization.seriesId && canAutoImport(parsed, allIssues) ? "IMPORTED" : "PENDING_REVIEW"}::"ClinicalSkinTestImportStatus",
        confidence = ${computeConfidence(parsed.confidence, allIssues)},
        error = null,
        issues = ${JSON.stringify(allIssues)}::jsonb,
        parsed_payload = ${JSON.stringify({ header: parsed.header, interpretation: parsed.interpretation, results: parsed.results })}::jsonb,
        result_hash = ${resultHash},
        duplicate_of_import_id = ${duplicate.kind === "probable" ? duplicate.sourceImportId : null},
        updated_at = now()
    WHERE id = ${id}
  `.execute(kysely);
  if (materialization.seriesId && canAutoImport(parsed, allIssues)) {
    await writeSkinTest(id, materialization.seriesId, parsed);
    await markImported(id);
  }
  return await getSkinTestImport(id);
}

export async function processSkinTestImports(ids: string[]) {
  const items: SkinTestImportOutput[] = [];
  const errors: Array<{ id: string; message: string }> = [];
  for (const id of ids) {
    try {
      items.push(await reprocessSkinTestImport(id));
    } catch (error) {
      errors.push({ id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { errors, items };
}

export async function listSkinTestsBySeries(clinicalSeriesId: number) {
  const testsResult = await sql<{
    ageLabel: null | string;
    address: null | string;
    clinicalNote: null | string;
    clinicalSeriesId: number;
    id: string;
    nonConclusiveDueToHyperreactivity: boolean;
    oneDriveWebUrl: null | string;
    panelTitle: null | string;
    patientEmail: null | string;
    patientName: null | string;
    patientPhone: null | string;
    patientRut: null | string;
    physicianName: null | string;
    physicianSpecialty: null | string;
    resultHash: null | string;
    sourceImportId: string;
    testDate: Date | string;
    website: null | string;
  }>`
    SELECT
      t.id,
      t.clinical_series_id AS "clinicalSeriesId",
      t.source_import_id AS "sourceImportId",
      t.test_date AS "testDate",
      t.patient_name AS "patientName",
      t.patient_rut AS "patientRut",
      t.patient_email AS "patientEmail",
      t.patient_phone AS "patientPhone",
      t.age_label AS "ageLabel",
      t.panel_title AS "panelTitle",
      t.clinical_note AS "clinicalNote",
      t.physician_name AS "physicianName",
      t.physician_specialty AS "physicianSpecialty",
      t.website,
      t.address,
      t.non_conclusive_due_to_hyperreactivity AS "nonConclusiveDueToHyperreactivity",
      t.result_hash AS "resultHash",
      i.onedrive_web_url AS "oneDriveWebUrl"
    FROM clinical_skin_tests t
    LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
    WHERE t.clinical_series_id = ${clinicalSeriesId}
      AND i.status = 'IMPORTED'
    ORDER BY t.test_date DESC, t.created_at DESC
  `.execute(kysely);

  if (testsResult.rows.length === 0) {
    return { tests: [] };
  }

  // Single query to fetch all results for all tests (eliminates N+1).
  const testIds = testsResult.rows.map((t) => t.id);
  const allResultsRows = await sql<{
    allergenName: string;
    code: null | string;
    controlType: "NEGATIVE" | "POSITIVE" | null;
    erythemaMm: null | number;
    papuleMm: null | number;
    rawCells: unknown;
    rawErythema: null | string;
    rawPapule: null | string;
    section: string;
    skinTestId: string;
    sortOrder: number;
  }>`
    SELECT
      skin_test_id AS "skinTestId",
      section,
      code,
      allergen_name AS "allergenName",
      papule_mm AS "papuleMm",
      erythema_mm AS "erythemaMm",
      raw_papule AS "rawPapule",
      raw_erythema AS "rawErythema",
      control_type AS "controlType",
      sort_order AS "sortOrder",
      raw_cells AS "rawCells"
    FROM clinical_skin_test_results
    WHERE skin_test_id = ANY(ARRAY[${sql.join(testIds)}]::text[])
    ORDER BY skin_test_id, sort_order ASC
  `.execute(kysely);

  // Group results by test id in-memory.
  const resultsByTestId = new Map<string, ParsedSkinTestResult[]>();
  for (const row of allResultsRows.rows) {
    const { skinTestId, ...rest } = row;
    let group = resultsByTestId.get(skinTestId);
    if (!group) {
      group = [];
      resultsByTestId.set(skinTestId, group);
    }
    group.push({ ...rest, rawCells: asRecord(rest.rawCells) });
  }

  const tests: SkinTestDetailOutput[] = testsResult.rows.map((test) => ({
    ...test,
    results: resultsByTestId.get(test.id) ?? [],
    testDate: toDateString(test.testDate),
  }));

  return { tests };
}

export async function listClinicalDocumentsBySeries(clinicalSeriesId: number) {
  const result = await sql<{
    accountEmail: null | string;
    accountName: null | string;
    clinicalSeriesId: null | number;
    documentKind: ClinicalDocumentImportKind;
    extractedPatientName: null | string;
    filename: string;
    id: string;
    importedAt: Date | null;
    issues: unknown;
    modifiedAt: Date | null;
    oneDriveAccountId: null | string;
    oneDriveWebUrl: null | string;
    path: null | string;
    size: null | number;
    status: ClinicalDocumentImportStatus;
    updatedAt: Date;
  }>`
    SELECT
      d.id,
      d.onedrive_account_id AS "oneDriveAccountId",
      a.email AS "accountEmail",
      a.name AS "accountName",
      d.onedrive_web_url AS "oneDriveWebUrl",
      d.path,
      d.filename,
      d.size,
      d.modified_at AS "modifiedAt",
      d.document_kind AS "documentKind",
      d.status,
      d.extracted_patient_name AS "extractedPatientName",
      d.clinical_series_id AS "clinicalSeriesId",
      d.issues,
      d.imported_at AS "importedAt",
      d.updated_at AS "updatedAt"
    FROM clinical_document_imports d
    LEFT JOIN onedrive_accounts a ON a.account_id = d.onedrive_account_id
    WHERE d.clinical_series_id = ${clinicalSeriesId}
      AND d.status = 'MATCHED'
    ORDER BY d.modified_at DESC NULLS LAST, d.updated_at DESC
  `.execute(kysely);

  const documents: ClinicalDocumentImportOutput[] = result.rows.map((row) => ({
    ...row,
    importedAt: row.importedAt?.toISOString() ?? null,
    issues: Array.isArray(row.issues) ? (row.issues as SkinTestIssue[]) : [],
    modifiedAt: row.modifiedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return { documents };
}

async function maybeMaterializeImport(
  importId: string,
  parsed: ParsedSkinTestWorkbook
): Promise<MatchResult> {
  void importId;
  const match = await matchOrCreateClinicalSeries(
    { header: parsed.header, results: parsed.results },
    { allowCreate: canAutoImport(parsed, parsed.issues) }
  );
  return match;
}

async function matchOrCreateClinicalSeries(
  payload: ParsedPayload,
  options: { allowCreate: boolean }
): Promise<MatchResult> {
  const issues: SkinTestIssue[] = [];
  const { patientRut, patientName, testDate } = payload.header;
  if (!patientRut || !testDate) {
    return { issues, seriesId: null };
  }

  const matches = await sql<{ id: number }>`
    SELECT cs.id
    FROM clinical_series cs
    LEFT JOIN events e ON e.clinical_series_id = cs.id
    WHERE cs.kind = 'SKIN_TEST'
      AND cs.patient_rut = ${patientRut}
      AND (
        e.id IS NULL
        OR e.start_date = ${testDate}::date
        OR e.start_date BETWEEN (${testDate}::date - interval '14 days') AND (${testDate}::date + interval '14 days')
      )
    GROUP BY cs.id
    ORDER BY min(abs(coalesce(e.start_date, ${testDate}::date) - ${testDate}::date)) NULLS LAST, cs.id DESC
    LIMIT 3
  `.execute(kysely);

  if (matches.rows.length === 1) {
    return { issues, seriesId: matches.rows[0]?.id ?? null };
  }
  if (matches.rows.length > 1) {
    return {
      issues: [
        {
          code: "multiple_series_candidates",
          message: "Hay más de una serie clínica candidata para este RUT y fecha.",
          severity: "error",
        },
      ],
      seriesId: null,
    };
  }

  if (!options.allowCreate) {
    return {
      issues: [
        {
          code: "series_pending_review",
          message: "No hay serie clínica existente; se creará al aprobar la importación.",
          severity: "warning",
        },
      ],
      seriesId: null,
    };
  }

  const created = await sql<{ id: number }>`
    INSERT INTO clinical_series (
      kind,
      status,
      display_name,
      patient_name,
      patient_rut,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      'SKIN_TEST',
      'ACTIVE',
      ${patientName ?? `Test cutáneo ${patientRut}`},
      ${patientName},
      ${patientRut},
      ${`Creada automáticamente desde importación de test cutáneo ${testDate}.`},
      now(),
      now()
    )
    RETURNING id
  `.execute(kysely);
  return { issues, seriesId: created.rows[0]?.id ?? null };
}

// Max rows per INSERT batch. Each row has 13 bind params;
// PostgreSQL supports up to 65535 params → safe cap at 500 rows.
const RESULTS_BATCH_SIZE = 500;

async function writeSkinTest(
  importId: string,
  seriesId: number,
  parsed: Pick<ParsedSkinTestWorkbook, "header" | "interpretation" | "results">
) {
  const { header } = parsed;
  const interpretation = parsed.interpretation ?? emptyInterpretation();
  const resultHash = computeResultHash(parsed.results);
  if (!header.testDate) throw new Error("No se puede importar un test sin fecha.");
  await sql`DELETE FROM clinical_skin_tests WHERE source_import_id = ${importId}`.execute(kysely);
  const skinTestId = createId();
  await sql`
    INSERT INTO clinical_skin_tests (
      id,
      clinical_series_id,
      source_import_id,
      test_date,
      patient_name,
      patient_rut,
      patient_email,
      patient_phone,
      age_label,
      panel_title,
      clinical_note,
      physician_name,
      physician_specialty,
      website,
      address,
      non_conclusive_due_to_hyperreactivity,
      result_hash,
      raw_header,
      created_at,
      updated_at
    )
    VALUES (
      ${skinTestId},
      ${seriesId},
      ${importId},
      ${header.testDate}::date,
      ${header.patientName},
      ${header.patientRut},
      ${header.patientEmail},
      ${header.patientPhone},
      ${header.ageLabel},
      ${header.panelTitle},
      ${interpretation.clinicalNote},
      ${interpretation.physicianName},
      ${interpretation.physicianSpecialty},
      ${interpretation.website},
      ${interpretation.address},
      ${interpretation.nonConclusiveDueToHyperreactivity},
      ${resultHash},
      ${JSON.stringify({ ...header, interpretation })}::jsonb,
      now(),
      now()
    )
  `.execute(kysely);

  // Batch insert results — one query per chunk instead of one per row.
  for (let i = 0; i < parsed.results.length; i += RESULTS_BATCH_SIZE) {
    const chunk = parsed.results.slice(i, i + RESULTS_BATCH_SIZE);
    const valueRows = sql.join(
      chunk.map(
        (result) =>
          sql`(
            ${createId()},
            ${skinTestId},
            ${importId},
            ${result.section},
            ${result.code},
            ${result.allergenName},
            ${result.papuleMm},
            ${result.erythemaMm},
            ${result.rawPapule},
            ${result.rawErythema},
            ${result.controlType === null ? sql`NULL::"ClinicalSkinTestControlType"` : sql`${result.controlType}::"ClinicalSkinTestControlType"`},
            ${result.sortOrder},
            ${JSON.stringify(result.rawCells)}::jsonb
          )`
      )
    );
    await sql`
      INSERT INTO clinical_skin_test_results (
        id,
        skin_test_id,
        source_import_id,
        section,
        code,
        allergen_name,
        papule_mm,
        erythema_mm,
        raw_papule,
        raw_erythema,
        control_type,
        sort_order,
        raw_cells
      )
      VALUES ${valueRows}
      ON CONFLICT (source_import_id, section, code, allergen_name)
      DO UPDATE SET
        papule_mm = EXCLUDED.papule_mm,
        erythema_mm = EXCLUDED.erythema_mm,
        raw_papule = EXCLUDED.raw_papule,
        raw_erythema = EXCLUDED.raw_erythema,
        control_type = EXCLUDED.control_type,
        sort_order = EXCLUDED.sort_order,
        raw_cells = EXCLUDED.raw_cells
    `.execute(kysely);
  }
}

async function getResultsForTest(testId: string): Promise<ParsedSkinTestResult[]> {
  const rows = await sql<{
    allergenName: string;
    code: null | string;
    controlType: "NEGATIVE" | "POSITIVE" | null;
    erythemaMm: null | number;
    papuleMm: null | number;
    rawCells: unknown;
    rawErythema: null | string;
    rawPapule: null | string;
    section: string;
    sortOrder: number;
  }>`
    SELECT
      section,
      code,
      allergen_name AS "allergenName",
      papule_mm AS "papuleMm",
      erythema_mm AS "erythemaMm",
      raw_papule AS "rawPapule",
      raw_erythema AS "rawErythema",
      control_type AS "controlType",
      sort_order AS "sortOrder",
      raw_cells AS "rawCells"
    FROM clinical_skin_test_results
    WHERE skin_test_id = ${testId}
    ORDER BY sort_order ASC
  `.execute(kysely);
  return rows.rows.map((row) => ({ ...row, rawCells: asRecord(row.rawCells) }));
}

async function getStoredParsedPayload(id: string): Promise<ParsedPayload> {
  const result = await sql<{ parsedPayload: unknown }>`
    SELECT parsed_payload AS "parsedPayload"
    FROM clinical_skin_test_imports
    WHERE id = ${id}
  `.execute(kysely);
  const parsedPayload = result.rows[0]?.parsedPayload;
  if (!parsedPayload || typeof parsedPayload !== "object") {
    throw new Error("Import no tiene payload parseado.");
  }
  return parsedPayload as ParsedPayload;
}

async function getImportByOneDriveItemId(accountId: string, driveId: string, itemId: string) {
  const result = await sql<
    ImportRow & { oneDriveCTag: null | string; oneDriveETag: null | string }
  >`
    SELECT
      i.*,
      i.onedrive_account_id AS "oneDriveAccountId",
      a.email AS "accountEmail",
      a.name AS "accountName",
      i.onedrive_etag AS "oneDriveETag",
      i.onedrive_ctag AS "oneDriveCTag",
      i.parsed_payload AS "parsedPayload",
      i.modified_at AS "modifiedAt",
      i.onedrive_web_url AS "oneDriveWebUrl",
      i.reviewed_at AS "reviewedAt",
      i.review_notes AS "reviewNotes",
      i.imported_at AS "importedAt",
      i.updated_at AS "updatedAt"
    FROM clinical_skin_test_imports i
    LEFT JOIN onedrive_accounts a ON a.account_id = i.onedrive_account_id
    WHERE i.onedrive_account_id = ${accountId}
      AND i.onedrive_drive_id = ${driveId}
      AND i.onedrive_item_id = ${itemId}
  `.execute(kysely);
  return result.rows[0] ?? null;
}

async function getClinicalDocumentImportByOneDriveItemId(
  accountId: string,
  driveId: string,
  itemId: string
) {
  const result = await sql<{ id: string }>`
    SELECT id
    FROM clinical_document_imports
    WHERE onedrive_account_id = ${accountId}
      AND onedrive_drive_id = ${driveId}
      AND onedrive_item_id = ${itemId}
  `.execute(kysely);
  return result.rows[0] ?? null;
}

async function upsertImport(params: {
  accountId: string;
  confidence: number;
  duplicateOfImportId?: null | string;
  error: null | string;
  id: string;
  issues: SkinTestIssue[];
  metadata: {
    cTag: null | string;
    driveId: null | string;
    eTag: null | string;
    filename: string;
    id: string;
    mimeType: null | string;
    modifiedAt: null | string;
    path: null | string;
    size: null | number;
    webUrl: null | string;
  };
  parsedPayload: null | ParsedPayload;
  resultHash: null | string;
  status: SkinTestImportStatus;
}) {
  await sql`
    INSERT INTO clinical_skin_test_imports (
      id,
      onedrive_account_id,
      onedrive_item_id,
      onedrive_drive_id,
      onedrive_etag,
      onedrive_ctag,
      onedrive_web_url,
      path,
      filename,
      mime_type,
      size,
      modified_at,
      parser_version,
      status,
      confidence,
      error,
      issues,
      parsed_payload,
      result_hash,
      duplicate_of_import_id,
      created_at,
      updated_at
    )
    VALUES (
      ${params.id},
      ${params.accountId},
      ${params.metadata.id},
      ${params.metadata.driveId},
      ${params.metadata.eTag},
      ${params.metadata.cTag},
      ${params.metadata.webUrl},
      ${params.metadata.path},
      ${params.metadata.filename},
      ${params.metadata.mimeType},
      ${params.metadata.size},
      ${params.metadata.modifiedAt}::timestamptz,
      ${SKIN_TEST_PARSER_VERSION},
      ${params.status}::"ClinicalSkinTestImportStatus",
      ${params.confidence},
      ${params.error},
      ${JSON.stringify(params.issues)}::jsonb,
      ${params.parsedPayload ? JSON.stringify(params.parsedPayload) : null}::jsonb,
      ${params.resultHash},
      ${params.duplicateOfImportId ?? null},
      now(),
      now()
    )
    ON CONFLICT (onedrive_account_id, onedrive_drive_id, onedrive_item_id)
    DO UPDATE SET
      onedrive_account_id = EXCLUDED.onedrive_account_id,
      onedrive_drive_id = EXCLUDED.onedrive_drive_id,
      onedrive_etag = EXCLUDED.onedrive_etag,
      onedrive_ctag = EXCLUDED.onedrive_ctag,
      onedrive_web_url = EXCLUDED.onedrive_web_url,
      path = EXCLUDED.path,
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      modified_at = EXCLUDED.modified_at,
      parser_version = EXCLUDED.parser_version,
      status = EXCLUDED.status,
      confidence = EXCLUDED.confidence,
      error = EXCLUDED.error,
      issues = EXCLUDED.issues,
      parsed_payload = EXCLUDED.parsed_payload,
      result_hash = EXCLUDED.result_hash,
      duplicate_of_import_id = EXCLUDED.duplicate_of_import_id,
      updated_at = now()
  `.execute(kysely);
}

async function markImported(id: string) {
  await sql`
    UPDATE clinical_skin_test_imports
    SET status = 'IMPORTED',
        imported_at = coalesce(imported_at, now()),
        updated_at = now()
    WHERE id = ${id}
  `.execute(kysely);
}

function buildImportWhereSql(input: SkinTestImportListInput) {
  const query = input.query?.trim();
  return sql<boolean>`
    (${input.status ?? null}::text IS NULL OR i.status = ${input.status ?? null}::"ClinicalSkinTestImportStatus")
    AND (${input.confidenceMin ?? null}::int IS NULL OR i.confidence >= ${input.confidenceMin ?? null})
    AND (${input.confidenceMax ?? null}::int IS NULL OR i.confidence <= ${input.confidenceMax ?? null})
    AND (${input.dateFrom ?? null}::date IS NULL OR (i.parsed_payload->'header'->>'testDate')::date >= ${input.dateFrom ?? null}::date)
    AND (${input.dateTo ?? null}::date IS NULL OR (i.parsed_payload->'header'->>'testDate')::date <= ${input.dateTo ?? null}::date)
    AND (
      ${query ?? null}::text IS NULL
      OR i.filename ILIKE ${`%${query ?? ""}%`}
      OR i.path ILIKE ${`%${query ?? ""}%`}
      OR i.parsed_payload->'header'->>'patientName' ILIKE ${`%${query ?? ""}%`}
      OR i.parsed_payload->'header'->>'patientRut' ILIKE ${`%${query ?? ""}%`}
    )
  `;
}

function isRelevantXlsx(item: OneDriveItem): boolean {
  if (item.deleted) return false;
  if (!item.file) return false;
  if (!/\.xlsx$/i.test(item.name)) return false;
  if (/^~\$/.test(item.name)) return false;
  if (isBlockedDownloadPath(item.parentReference?.path)) return false;
  if (isBlockedDownloadPath(item.remoteItem?.parentReference?.path)) return false;
  return true;
}

function isImportableXlsx(item: OneDriveItem): boolean {
  return isRelevantXlsx(item) && isSkinTestCandidateFilename(item.name);
}

function isBlockedDownloadPath(path: null | string | undefined): boolean {
  if (!path) return false;
  return path
    .split(/[/:\\]+/)
    .map((segment) => segment.trim().toLowerCase())
    .some((segment) => ["descarga", "descargas", "download", "downloads"].includes(segment));
}

function classifyClinicalDocumentFilename(filename: string): ClinicalDocumentImportKind {
  const text = normalizeDocumentName(filename);
  if (
    /\b(?:consulta|consultas|control|controles|visita|visitas|evolucion|evoluciones)\b/.test(text)
  ) {
    return "VISIT_SHEET";
  }
  if (/\b(?:ficha|fichas|clinica|clinico|historia|antecedentes)\b/.test(text)) {
    return "CLINICAL_RECORD";
  }
  return "OTHER";
}

function extractPatientNameFromDocumentFilename(filename: string): null | string {
  const cleaned = normalizeDocumentName(filename)
    .replace(/\b(?:ficha|fichas|clinica|clinico|clinical|nueva|nuevo|completa|completo)\b/g, " ")
    .replace(/\b(?:consulta|consultas|medica|medico|control|controles|visita|visitas)\b/g, " ")
    .replace(/\b(?:final|fin|actualizado|actualizada|copia|copy|xlsx)\b/g, " ")
    .replace(/\b(?:i{1,3}|iv|v|vi{0,3}|ix|x)\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 3 ? toTitleCase(cleaned) : null;
}

function normalizeDocumentName(filename: string): string {
  return filename
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function matchClinicalSeriesByPatientName(
  patientName: string
): Promise<ClinicalDocumentSeriesMatch> {
  const normalized = normalizeDocumentName(patientName);
  if (!normalized) return { seriesId: null };
  const entries = await getClinicalSeriesNameEntries();

  const exactMatches = entries.filter((entry) => entry.normalizedName === normalized);
  if (exactMatches.length === 1) return { seriesId: exactMatches[0]?.id ?? null };
  if (exactMatches.length > 1) {
    return {
      issue: {
        code: "multiple_series_candidates",
        message: "Hay más de una serie clínica con el mismo nombre probable.",
        severity: "warning",
      },
      seriesId: null,
    };
  }

  const prefixMatches = entries.filter(
    (entry) =>
      entry.normalizedName.startsWith(`${normalized} `) ||
      normalized.startsWith(`${entry.normalizedName} `)
  );
  if (prefixMatches.length === 1) return { seriesId: prefixMatches[0]?.id ?? null };
  if (prefixMatches.length > 1) {
    return {
      issue: {
        code: "multiple_series_candidates",
        message: "Hay más de una serie clínica candidata por nombre de archivo.",
        severity: "warning",
      },
      seriesId: null,
    };
  }

  return { seriesId: null };
}

async function getClinicalSeriesNameEntries(): Promise<ClinicalSeriesNameEntry[]> {
  if (clinicalSeriesNameCache) return clinicalSeriesNameCache;
  const result = await sql<{ id: number; name: null | string }>`
    SELECT id, patient_name AS name
    FROM clinical_series
    WHERE patient_name IS NOT NULL
  `.execute(kysely);
  clinicalSeriesNameCache = result.rows
    .map((row) => ({
      id: row.id,
      name: row.name ?? "",
      normalizedName: normalizeDocumentName(row.name ?? ""),
    }))
    .filter((entry) => entry.normalizedName.length > 0);
  return clinicalSeriesNameCache;
}

function computeResultHash(results: ParsedSkinTestResult[]): string {
  const normalized = results
    .map((result) => ({
      allergenName: normalizeHashText(result.allergenName),
      code: result.code ?? "",
      controlType: result.controlType ?? "",
      erythema: result.rawErythema ?? result.erythemaMm ?? "",
      papule: result.rawPapule ?? result.papuleMm ?? "",
      section: normalizeHashText(result.section),
    }))
    .sort((a, b) =>
      `${a.section}|${a.code}|${a.allergenName}`.localeCompare(
        `${b.section}|${b.code}|${b.allergenName}`,
        "es"
      )
    );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function normalizeHashText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type DuplicateCheckResult =
  | { kind: "none" }
  | { issue: SkinTestIssue; kind: "exact" | "probable"; sourceImportId: string };

async function findDuplicateSkinTest(
  importId: string,
  parsed: ParsedSkinTestWorkbook,
  resultHash: string
): Promise<DuplicateCheckResult> {
  const { patientRut, testDate } = parsed.header;
  if (!patientRut || !testDate || parsed.results.length === 0) return { kind: "none" };

  const exact = await sql<{ sourceImportId: string; testDate: Date | string }>`
    SELECT source_import_id AS "sourceImportId", test_date AS "testDate"
    FROM clinical_skin_tests
    WHERE patient_rut = ${patientRut}
      AND test_date = ${testDate}::date
      AND result_hash = ${resultHash}
      AND source_import_id <> ${importId}
    ORDER BY created_at ASC
    LIMIT 1
  `.execute(kysely);
  const exactMatch = exact.rows[0];
  if (exactMatch) {
    return {
      issue: {
        code: "duplicate_exact_skin_test",
        message:
          "Este archivo tiene el mismo RUT, fecha y resultados que un test cutáneo ya importado; se omite como duplicado exacto.",
        severity: "info",
      },
      kind: "exact",
      sourceImportId: exactMatch.sourceImportId,
    };
  }

  const probable = await sql<{ sourceImportId: string; testDate: Date | string }>`
    SELECT source_import_id AS "sourceImportId", test_date AS "testDate"
    FROM clinical_skin_tests
    WHERE patient_rut = ${patientRut}
      AND result_hash = ${resultHash}
      AND test_date <> ${testDate}::date
      AND source_import_id <> ${importId}
    ORDER BY abs(test_date - ${testDate}::date) ASC, created_at ASC
    LIMIT 1
  `.execute(kysely);
  const probableMatch = probable.rows[0];
  if (probableMatch) {
    return {
      issue: {
        code: "probable_duplicate_different_date",
        message: `Mismo RUT y mismos resultados que otro test importado, pero con fecha distinta (${toDateString(probableMatch.testDate)}). Requiere revisión antes de importar.`,
        severity: "error",
      },
      kind: "probable",
      sourceImportId: probableMatch.sourceImportId,
    };
  }

  return { kind: "none" };
}

function emptyInterpretation(): ParsedSkinTestInterpretation {
  return {
    address: null,
    clinicalNote: null,
    nonConclusiveDueToHyperreactivity: false,
    physicianName: null,
    physicianSpecialty: null,
    suggestedEvaluation: null,
    website: null,
  };
}

function canAutoImport(parsed: ParsedSkinTestWorkbook, issues: SkinTestIssue[]): boolean {
  return (
    parsed.confidence >= AUTO_IMPORT_MIN_CONFIDENCE &&
    parsed.results.length > 0 &&
    issues.every((issue) => issue.severity !== "error")
  );
}

function computeConfidence(baseConfidence: number, issues: SkinTestIssue[]): number {
  const penalty = issues.reduce(
    (acc, issue) => acc + (issue.severity === "error" ? 35 : issue.severity === "warning" ? 10 : 0),
    0
  );
  return Math.max(0, Math.min(100, baseConfidence - penalty));
}

function toImportOutput(row: ImportRow): SkinTestImportOutput {
  return {
    accountEmail: row.accountEmail ?? null,
    accountName: row.accountName ?? null,
    confidence: row.confidence,
    error: row.error,
    filename: row.filename,
    id: row.id,
    importedAt: row.importedAt?.toISOString() ?? null,
    issues: Array.isArray(row.issues) ? (row.issues as SkinTestIssue[]) : [],
    modifiedAt: row.modifiedAt?.toISOString() ?? null,
    oneDriveAccountId: row.oneDriveAccountId ?? null,
    oneDriveWebUrl: row.oneDriveWebUrl,
    parsedPayload:
      row.parsedPayload && typeof row.parsedPayload === "object"
        ? (row.parsedPayload as ParsedPayload)
        : null,
    path: row.path,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNotes: row.reviewNotes,
    skinTestId: row.skinTestId ?? null,
    matchedSeriesId: row.matchedSeriesId ?? null,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
