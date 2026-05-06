import { kysely } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import { createHash } from "node:crypto";
import { sql } from "kysely";
import {
  downloadOneDriveItem,
  getOneDriveStatus,
  getOneDriveCrc32Hash,
  getOneDriveQuickXorHash,
  getOneDriveSha1Hash,
  listOneDriveDeltaItems,
  type OneDriveItem,
} from "../lib/microsoft/onedrive";
import {
  classifyClinicalXlsxFilename,
  type ClinicalXlsxFileClassification,
} from "../lib/clinical-xlsx-file-classifier";
import { isImportableSkinTestFilename } from "../lib/skin-test-file-filter";
import {
  parseSkinTestWorkbookBuffer,
  SKIN_TEST_PARSER_VERSION,
  type ParsedSkinTestInterpretation,
  type ParsedSkinTestResult,
  type ParsedSkinTestWorkbook,
  type SkinTestIssue,
} from "./clinical-skin-test-parser";
import { persistSkinTestWorkbookSnapshot } from "./clinical-skin-test-workbook-snapshots";

const AUTO_IMPORT_MIN_CONFIDENCE = 80;
const JOB_TYPE = "clinical-skin-test-import-sync";
const DEFAULT_SYNC_CONCURRENCY = 3;
const MAX_SYNC_CONCURRENCY = 8;
const DEFAULT_ARCHIVE_CONCURRENCY = 4;
const MAX_ARCHIVE_CONCURRENCY = 8;
const ARCHIVE_BATCH_SIZE = 500;
const ARCHIVE_UNLIMITED_THRESHOLD = 10_000;

export type SkinTestSyncProgressPhase =
  | "archiving"
  | "completed"
  | "delta"
  | "discovered-processing"
  | "pending-reprocessing"
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
  downloadedBytes?: number;
  dryRun?: boolean;
  elapsedSeconds?: number;
  errors?: number;
  etaSeconds?: number | null;
  failed?: number;
  filesProcessed?: number;
  filesTotal?: number;
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
  archived?: number;
}

export interface SkinTestImportListInput {
  confidenceMax?: number;
  confidenceMin?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  snapshotStatus?: "ARCHIVED" | "ERROR" | "MISSING" | "STALE";
  sortBy?: "testDate" | "updatedAt";
  status?: SkinTestImportStatus;
}

export type SkinTestImportStatus =
  | "DISCOVERED"
  | "ERROR"
  | "IMPORTED"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "SKIPPED"
  | "TEMPLATE";

type SkinTestWorkbookSnapshotStatus = "ARCHIVED" | "ERROR" | "MISSING" | "STALE";

export interface SkinTestImportOutput {
  accountEmail: null | string;
  accountName: null | string;
  confidence: number;
  duplicateOfImportId: null | string;
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
  workbookSnapshot: {
    archivedAt: null | string;
    cellCount: null | number;
    error: null | string;
    extractorVersion: null | string;
    mergeCount: null | number;
    sheetName: null | string;
    sha256: null | string;
    status: SkinTestWorkbookSnapshotStatus;
    textHash: null | string;
    updatedAt: null | string;
  };
}

export interface ParsedPayload {
  header: ParsedSkinTestWorkbook["header"];
  interpretation?: ParsedSkinTestWorkbook["interpretation"];
  results: ParsedSkinTestResult[];
}

interface OneDriveItemMetadata {
  cTag: null | string;
  driveId: null | string;
  eTag: null | string;
  filename: string;
  id: string;
  mimeType: null | string;
  modifiedAt: null | string;
  path: null | string;
  size: null | number;
  sourceDriveId: null | string;
  sourceItemId: null | string;
  sourceKey: null | string;
  sharePointUniqueId: null | string;
  quickXorHash: null | string;
  sha1Hash: null | string;
  crc32Hash: null | string;
  webUrl: null | string;
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

export interface SkinTestAnalyticsInput {
  dateFrom?: string;
  dateTo?: string;
  examType?: string;
  pageSize?: number;
  query?: string;
}

export interface SkinTestAnalyticsOutput {
  byExamType: Array<{ examType: string; total: number }>;
  byMonth: Array<{ month: string; total: number }>;
  dateFrom: null | string;
  dateTo: null | string;
  patientsWithPositiveAllergen: number;
  positiveAllergenResults: number;
  positiveTests: number;
  recentTests: Array<{
    clinicalSeriesId: number;
    examType: string;
    id: string;
    oneDriveWebUrl: null | string;
    panelTitle: null | string;
    patientName: null | string;
    patientRut: null | string;
    resultCount: number;
    testDate: string;
  }>;
  topPatients: Array<{
    lastTestDate: null | string;
    patientName: null | string;
    patientRut: null | string;
    totalTests: number;
  }>;
  topAllergens: Array<{
    allergenName: string;
    avgPapuleMm: null | number;
    category: null | string;
    code: null | string;
    maxPapuleMm: null | number;
    positiveResults: number;
    section: string;
    scientificName: null | string;
    testCount: number;
    uniquePatients: number;
  }>;
  totalPatients: number;
  totalResults: number;
  totalTests: number;
  withRut: number;
  withoutRut: number;
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

interface ClinicalAllergenCatalogRow {
  aliasType: string;
  allergenId: string;
  category: string;
  commonName: string;
  englishName: null | string;
  normalizedAlias: string;
  pollenType: null | string;
  scientificName: null | string;
}

interface ClinicalAllergenCatalogEntry {
  aliasType: string;
  allergenId: string;
  category: string;
  commonName: string;
  englishName: null | string;
  normalizedAlias: string;
  pollenType: null | string;
  scientificName: null | string;
}

interface ImportRow {
  accountEmail?: null | string;
  accountName?: null | string;
  confidence: number;
  duplicateOfImportId: null | string;
  error: null | string;
  filename: string;
  id: string;
  importedAt: Date | null;
  issues: unknown;
  modifiedAt: Date | null;
  oneDriveAccountId?: null | string;
  oneDriveQuickXorHash?: null | string;
  oneDriveWebUrl: null | string;
  parsedPayload: unknown;
  path: null | string;
  reviewedAt: Date | null;
  reviewNotes: null | string;
  skinTestId?: null | string;
  matchedSeriesId?: null | number;
  status: SkinTestImportStatus;
  updatedAt: Date;
  workbookSnapshotArchivedAt: Date | null;
  workbookSnapshotCellCount?: null | number;
  workbookSnapshotError: null | string;
  workbookSnapshotExtractorVersion?: null | string;
  workbookSnapshotMergeCount?: null | number;
  workbookSnapshotSha256?: null | string;
  workbookSnapshotSheetName?: null | string;
  workbookSnapshotStatus: SkinTestWorkbookSnapshotStatus;
  workbookSnapshotTextHash?: null | string;
  workbookSnapshotUpdatedAt?: Date | null;
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

export async function reclassifyClinicalXlsxLibrary(options?: {
  onProgress?: (progress: SkinTestSyncProgress & { message: string }) => void;
  shouldCancel?: () => boolean;
}) {
  const rows = (
    await sql<
      {
        classification: ClinicalXlsxFileClassification;
        filename: string;
        id: string;
        modifiedAt: null | string;
        oneDriveAccountId: string;
        oneDriveCTag: null | string;
        oneDriveDriveId: null | string;
        oneDriveETag: null | string;
        oneDriveItemId: string;
        oneDriveSharePointUniqueId: null | string;
        oneDriveSourceDriveId: null | string;
        oneDriveSourceItemId: null | string;
        oneDriveSourceKey: null | string;
        oneDriveWebUrl: null | string;
        path: null | string;
        mimeType: null | string;
        size: null | number;
      }
    >`
      SELECT
        id,
        onedrive_account_id AS "oneDriveAccountId",
        onedrive_item_id AS "oneDriveItemId",
        onedrive_drive_id AS "oneDriveDriveId",
        onedrive_source_key AS "oneDriveSourceKey",
        onedrive_source_drive_id AS "oneDriveSourceDriveId",
        onedrive_source_item_id AS "oneDriveSourceItemId",
        onedrive_sharepoint_unique_id AS "oneDriveSharePointUniqueId",
        onedrive_etag AS "oneDriveETag",
        onedrive_ctag AS "oneDriveCTag",
        onedrive_web_url AS "oneDriveWebUrl",
        path,
        filename,
        mime_type AS "mimeType",
        size,
        modified_at::text AS "modifiedAt",
        classification
      FROM clinical_xlsx_files
      ORDER BY updated_at DESC, id ASC
    `.execute(kysely)
  ).rows;

  let changed = 0;
  let clinicalDocumentsToSkinTests = 0;
  let importableSkinTests = 0;
  let queuedImports = 0;
  let libraryOnlySkinTests = 0;
  let skippedUnchanged = 0;

  const total = rows.length;
  options?.onProgress?.({
    message: `Reclasificando ${total} XLSX de la librería`,
    phase: "processing",
    processed: 0,
    total,
  });

  for (const [index, row] of rows.entries()) {
    if (options?.shouldCancel?.()) throw new Error("SYNC_CANCELLED");

    const next = classifyClinicalXlsxFilename(row.filename);
    if (next.classification === row.classification) {
      skippedUnchanged += 1;
    } else {
      changed += 1;
      if (row.classification === "CLINICAL_DOCUMENT" && next.classification === "SKIN_TEST") {
        clinicalDocumentsToSkinTests += 1;
      }
      await sql`
        UPDATE clinical_xlsx_files
        SET classification = ${next.classification}::"ClinicalXlsxFileClassification",
            classification_reason = ${next.reason},
            updated_at = now()
        WHERE id = ${row.id}
      `.execute(kysely);
    }

    if (next.classification === "SKIN_TEST") {
      if (isImportableSkinTestFilename(row.filename)) {
        importableSkinTests += 1;
        const driveId = row.oneDriveDriveId ?? "unknown";
        const existingImport = await getImportByOneDriveItemId(
          row.oneDriveAccountId,
          driveId,
          row.oneDriveItemId
        );
        if (!existingImport) {
          queuedImports += 1;
          const metadata = {
            cTag: row.oneDriveCTag,
            driveId,
            eTag: row.oneDriveETag,
            filename: row.filename,
            id: row.oneDriveItemId,
            mimeType: row.mimeType,
            modifiedAt: row.modifiedAt,
            path: row.path,
            size: row.size,
            sourceDriveId: row.oneDriveSourceDriveId,
            sourceItemId: row.oneDriveSourceItemId,
            sourceKey: row.oneDriveSourceKey,
            sharePointUniqueId: row.oneDriveSharePointUniqueId,
            quickXorHash: null,
            sha1Hash: null,
            crc32Hash: null,
            webUrl: row.oneDriveWebUrl,
          };
          const importId = createId();
          const sharedDuplicate = await findOneDriveSharedDuplicateImport(
            metadata.sourceKey,
            importId
          );
          await upsertImport({
            accountId: row.oneDriveAccountId,
            confidence: 0,
            duplicateOfImportId: sharedDuplicate?.sourceImportId ?? null,
            error: null,
            id: importId,
            issues: sharedDuplicate
              ? [getOneDriveSharedDuplicateIssue(sharedDuplicate.filename)]
              : [],
            metadata,
            parsedPayload: null,
            resultHash: null,
            status: sharedDuplicate ? "SKIPPED" : "DISCOVERED",
          });
        }
      } else {
        libraryOnlySkinTests += 1;
      }
    }

    const processed = index + 1;
    if (processed % 250 === 0 || processed === total) {
      options?.onProgress?.({
        discovered: queuedImports,
        imported: importableSkinTests,
        message: `Reclasificados ${processed}/${total} XLSX`,
        phase: "processing",
        processed,
        skipped: skippedUnchanged,
        total,
        xlsx: total,
      });
    }
  }

  return {
    changed,
    clinicalDocumentsToSkinTests,
    importableSkinTests,
    libraryOnlySkinTests,
    queuedImports,
    skippedUnchanged,
    total,
  };
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
  let skipped = 0;
  let unchanged = 0;
  let errors = 0;
  let discovered = 0;
  let documents = 0;
  let documentsMatched = 0;
  let documentsUnmatched = 0;
  let scanned = 0;
  let xlsx = 0;
  let filesProcessed = 0;
  const workItems: Array<{
    account: (typeof accounts)[number];
    item: OneDriveItem;
    key: string;
  }> = [];

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
    filesProcessed,
    filesTotal: 0,
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
      filesProcessed,
      filesTotal: 0,
    });

    let accountXlsxSoFar = 0;
    const { items } = await listOneDriveDeltaItems(account.accountId, {
      folderDriveId: options?.folderDriveId,
      folderItemId: options?.folderItemId,
      folderPath: options?.folderPath,
      force: options?.force,
      onPage: ({ items: pageItems, itemsSoFar, page }) => {
        accountXlsxSoFar += pageItems.filter(isRelevantXlsx).length;
        emit(`[${account.email}] Leyendo OneDrive: lote Graph ${page}, ${itemsSoFar} item(s)`, {
          accountEmail: account.email,
          accountId: account.accountId,
          accountIndex: accountIndex + 1,
          accountsTotal: accounts.length,
          page,
          phase: "delta",
          processed: accountIndex,
          scanned: scanned + itemsSoFar,
          total: accounts.length,
          xlsx: xlsx + accountXlsxSoFar,
          documents,
          documentsMatched,
          documentsUnmatched,
          filesProcessed,
          filesTotal: 0,
        });
      },
    });
    const deletedItems = items.filter((i) => i.deleted);
    const xlsxItems = items.filter(isRelevantXlsx);
    scanned += items.length;
    xlsx += xlsxItems.length;

    if (deletedItems.length > 0) {
      await Promise.all(
        deletedItems.map((item) =>
          markOneDriveItemDeleted(
            account.accountId,
            item.parentReference?.driveId ?? options?.folderDriveId ?? account.accountId,
            item.id
          )
        )
      );
    }

    workItems.push(...xlsxItems.map((item) => ({ account, item, key: `${account.accountId}:${item.id}` })));

    emit(
      `[${account.email}] ${items.length} cambio(s), ${xlsxItems.length} xlsx`,
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
        filesProcessed,
        filesTotal: 0,
      }
    );
  }

  const totalWorkItems = workItems.length;
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
      filesProcessed,
      filesTotal: 0,
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

  const quickXorHashCanonicalFiles = new Map<string, string>();
  const quickXorHashDuplicates = new Map<string, SkinTestIssue>();
  for (const { key, item } of workItems) {
    const metadata = buildOneDriveItemMetadata(item, item.parentReference?.driveId ?? "unknown");
    const classification = classifyClinicalXlsxFilename(metadata.filename);
    if (
      classification.classification !== "SKIN_TEST" ||
      !isImportableSkinTestFilename(metadata.filename)
    ) {
      continue;
    }
    if (!metadata.quickXorHash) continue;
    const canonicalFilename = quickXorHashCanonicalFiles.get(metadata.quickXorHash);
    if (canonicalFilename) {
      quickXorHashDuplicates.set(key, getOneDriveQuickXorHashDuplicateIssue(canonicalFilename));
      continue;
    }
    quickXorHashCanonicalFiles.set(metadata.quickXorHash, metadata.filename);
  }

  let cursor = 0;
  const workerCount = Math.min(concurrency, workItems.length);

  emit(`Registrando ${workItems.length} xlsx para snapshot`, {
    accountsTotal: accounts.length,
    documents,
    documentsMatched,
    documentsUnmatched,
    phase: "processing",
    filesProcessed,
    filesTotal: totalWorkItems,
    processed: accounts.length + filesProcessed,
    scanned,
    total: accounts.length + totalWorkItems,
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

      const { account, item, key } = workItems[index];
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
        filesProcessed,
        filesTotal: totalWorkItems,
        phase: "processing",
        processed: accounts.length + filesProcessed,
        scanned,
        skipped,
        total: accounts.length + totalWorkItems,
        unchanged,
        xlsx,
      });

      const result = await discoverOneDriveClinicalXlsxItem(account.accountId, item, {
        contentDuplicate: quickXorHashDuplicates.get(key) ?? null,
        force: options?.force,
      });

      if (result.syncAction === "SKIPPED_UNCHANGED") {
        unchanged += 1;
      } else if (result.classification === "SKIN_TEST") {
        if (result.status === "DISCOVERED") discovered += 1;
        else if (result.status === "IMPORTED") imported += 1;
        else if (result.status === "PENDING_REVIEW") pending += 1;
        else if (result.status === "ERROR") errors += 1;
        else skipped += 1;
      } else if (result.classification === "CLINICAL_DOCUMENT") {
        documents += 1;
        if (result.status === "MATCHED") documentsMatched += 1;
        else if (result.status === "UNMATCHED") documentsUnmatched += 1;
      } else {
        skipped += 1;
      }

      filesProcessed += 1;
      emit(
        `[${account.email}] ${item.name}: ${result.syncAction === "SKIPPED_UNCHANGED" ? "sin cambios" : `${result.classification}:${result.status}`}`,
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
          filesProcessed,
          filesTotal: totalWorkItems,
          phase: "processing",
          processed: accounts.length + filesProcessed,
          scanned,
          skipped,
          total: accounts.length + totalWorkItems,
          unchanged,
          xlsx,
        }
      );
    }
  });

  await Promise.all(workers);

  emit(
    `Sync terminado: ${discovered} xlsx descubierto(s), ${unchanged} sin cambios, ${errors} error(es)`,
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
      filesProcessed,
      filesTotal: totalWorkItems,
      processed: accounts.length + filesProcessed,
      scanned,
      skipped,
      total: accounts.length + totalWorkItems,
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

function resolveArchiveConcurrency(): number {
  const raw = Number.parseInt(process.env.SKIN_TEST_ARCHIVE_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_ARCHIVE_CONCURRENCY;
  }
  return Math.min(Math.max(raw, 1), MAX_ARCHIVE_CONCURRENCY);
}

export async function processOneDriveSkinTestItem(
  accountId: string,
  item: OneDriveItem,
  options?: { contentDuplicate?: null | SkinTestIssue; force?: boolean }
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
    const incomingHash = getOneDriveQuickXorHash(item);
    if (incomingHash && !existing.oneDriveQuickXorHash) {
      await sql`
        UPDATE clinical_skin_test_imports
        SET onedrive_quick_xor_hash = ${incomingHash}, updated_at = now()
        WHERE id = ${existing.id}
      `.execute(kysely);
    }
    return {
      ...toImportOutput(existing),
      syncAction: "SKIPPED_UNCHANGED",
    };
  }

  const importId = existing?.id ?? createId();
  const metadata = buildOneDriveItemMetadata(item, driveId);

  if (options?.contentDuplicate) {
    await ensureImportMetadataRow(accountId, importId, metadata);
    await upsertImport({
      accountId,
      confidence: 0,
      duplicateOfImportId: null,
      error: null,
      id: importId,
      issues: [options.contentDuplicate],
      metadata,
      parsedPayload: null,
      resultHash: null,
      status: "SKIPPED",
    });
    return await getSkinTestImport(importId);
  }

  try {
    const buffer = await downloadOneDriveItem(accountId, item.id, driveId);
    await ensureImportMetadataRow(accountId, importId, metadata);
    const snapshotResult = await persistSkinTestWorkbookSnapshot({
      buffer,
      importId,
      sourceCTag: metadata.cTag,
      sourceETag: metadata.eTag,
      sourceSizeBytes: metadata.size,
    });

    const sha256Duplicate = await findWorkbookSha256DuplicateImport(snapshotResult.sha256, importId);
    if (sha256Duplicate) {
      await upsertImport({
        accountId,
        confidence: 0,
        duplicateOfImportId: sha256Duplicate.sourceImportId,
        error: null,
        id: importId,
        issues: [getWorkbookSha256DuplicateIssue(sha256Duplicate.filename)],
        metadata,
        parsedPayload: null,
        resultHash: null,
        status: "SKIPPED",
      });
      return await getSkinTestImport(importId);
    }

    const parsed = await parseSkinTestWorkbookBuffer(
      buffer
    );
    const resultHash = computeResultHash(parsed.results);
    const templateIssue = getTemplateSkinTestIssue(parsed);
    if (templateIssue) {
      await upsertImport({
        accountId,
        confidence: 0,
        duplicateOfImportId: null,
        error: null,
        id: importId,
        issues: [templateIssue],
        metadata,
        parsedPayload: {
          header: parsed.header,
          interpretation: parsed.interpretation,
          results: parsed.results,
        },
        resultHash,
        status: "TEMPLATE",
      });
      return await getSkinTestImport(importId);
    }

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

async function discoverOneDriveClinicalXlsxItem(
  accountId: string,
  item: OneDriveItem,
  options?: { contentDuplicate?: null | SkinTestIssue; force?: boolean }
): Promise<{
  classification: ClinicalXlsxFileClassification;
  id: string;
  status: ClinicalDocumentImportStatus | SkinTestImportStatus | "LIBRARY_ONLY";
  syncAction?: "PROCESSED" | "SKIPPED_UNCHANGED";
}> {
  const driveId = item.parentReference?.driveId ?? "unknown";
  const metadata = buildOneDriveItemMetadata(item, driveId);
  const classification = classifyClinicalXlsxFilename(metadata.filename);
  const existing = await getClinicalXlsxFileByOneDriveItemId(accountId, driveId, item.id);

  if (
    existing &&
    !options?.force &&
    existing.oneDriveETag === metadata.eTag &&
    existing.oneDriveCTag === metadata.cTag &&
    existing.classification === classification.classification
  ) {
    return {
      classification: classification.classification,
      id: existing.id,
      status: "LIBRARY_ONLY",
      syncAction: "SKIPPED_UNCHANGED",
    };
  }

  const libraryId = existing?.id ?? createId();
  await upsertClinicalXlsxFile({
    accountId,
    classification,
    id: libraryId,
    metadata,
  });

  if (
    classification.classification === "SKIN_TEST" &&
    isImportableSkinTestFilename(metadata.filename)
  ) {
    const result = await discoverOneDriveSkinTestItem(accountId, item, options);
    return {
      classification: "SKIN_TEST",
      id: result.id,
      status: result.status,
      syncAction: result.syncAction ?? "PROCESSED",
    };
  }

  if (classification.classification === "CLINICAL_DOCUMENT") {
    const result = await discoverOneDriveClinicalDocument(accountId, item);
    return {
      classification: "CLINICAL_DOCUMENT",
      id: result.id,
      status: result.status,
      syncAction: "PROCESSED",
    };
  }

  return {
    classification: "OTHER",
    id: libraryId,
    status: "LIBRARY_ONLY",
    syncAction: "PROCESSED",
  };
}

export async function discoverOneDriveClinicalDocument(
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
  const documentKind = classifyClinicalDocumentFilename(metadata.filename);
  const extractedPatientName = extractPatientNameFromDocumentFilename(metadata.filename);
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
  options?: { contentDuplicate?: null | SkinTestIssue; force?: boolean }
): Promise<SkinTestImportOutput> {
  const driveId = item.parentReference?.driveId ?? "unknown";
  const existing = await getImportByOneDriveItemId(accountId, driveId, item.id);
  if (
    existing &&
    !options?.force &&
    existing.oneDriveETag === item.eTag &&
    existing.oneDriveCTag === item.cTag
  ) {
    const incomingHash = getOneDriveQuickXorHash(item);
    if (incomingHash && !existing.oneDriveQuickXorHash) {
      await sql`
        UPDATE clinical_skin_test_imports
        SET onedrive_quick_xor_hash = ${incomingHash}, updated_at = now()
        WHERE id = ${existing.id}
      `.execute(kysely);
    }
    return {
      ...toImportOutput(existing),
      syncAction: "SKIPPED_UNCHANGED",
    };
  }

  const importId = existing?.id ?? createId();
  const metadata = buildOneDriveItemMetadata(item, driveId);
  if (options?.contentDuplicate) {
    await upsertImport({
      accountId,
      confidence: 0,
      duplicateOfImportId: null,
      error: null,
      id: importId,
      issues: [options.contentDuplicate],
      metadata,
      parsedPayload: null,
      resultHash: null,
      status: "SKIPPED",
    });
    return await getSkinTestImport(importId);
  }
  if (existing) {
    await sql`
      UPDATE clinical_skin_test_imports
      SET onedrive_source_key = ${metadata.sourceKey},
          onedrive_source_drive_id = ${metadata.sourceDriveId},
          onedrive_source_item_id = ${metadata.sourceItemId},
          onedrive_sharepoint_unique_id = ${metadata.sharePointUniqueId},
          onedrive_etag = ${metadata.eTag},
          onedrive_ctag = ${metadata.cTag},
          onedrive_web_url = ${metadata.webUrl},
          path = ${metadata.path},
          filename = ${metadata.filename},
          mime_type = ${metadata.mimeType},
          size = ${metadata.size},
          modified_at = ${metadata.modifiedAt}::timestamptz,
          workbook_snapshot_status = CASE
            WHEN workbook_snapshot_status = 'ARCHIVED'
              AND (onedrive_etag IS DISTINCT FROM ${metadata.eTag} OR onedrive_ctag IS DISTINCT FROM ${metadata.cTag})
            THEN 'STALE'::"ClinicalSkinTestWorkbookSnapshotStatus"
            ELSE workbook_snapshot_status
          END,
          updated_at = now()
      WHERE id = ${importId}
    `.execute(kysely);
    return await getSkinTestImport(importId);
  }

  const sharedDuplicate = await findOneDriveSharedDuplicateImport(metadata.sourceKey, importId);
  if (sharedDuplicate) {
    await upsertImport({
      accountId,
      confidence: 0,
      duplicateOfImportId: sharedDuplicate.sourceImportId,
      error: null,
      id: importId,
      issues: [getOneDriveSharedDuplicateIssue(sharedDuplicate.filename)],
      metadata,
      parsedPayload: null,
      resultHash: null,
      status: "SKIPPED",
    });
    return await getSkinTestImport(importId);
  }

  if (metadata.quickXorHash) {
    const xorDuplicate = await findQuickXorHashDuplicateImport(metadata.quickXorHash, importId);
    if (xorDuplicate) {
      await upsertImport({
        accountId,
        confidence: 0,
        duplicateOfImportId: xorDuplicate.sourceImportId,
        error: null,
        id: importId,
        issues: [getOneDriveQuickXorHashDuplicateIssue(xorDuplicate.filename)],
        metadata,
        parsedPayload: null,
        resultHash: null,
        status: "SKIPPED",
      });
      return await getSkinTestImport(importId);
    }
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

function buildOneDriveItemMetadata(item: OneDriveItem, driveId: string): OneDriveItemMetadata {
  const remote = item.remoteItem;
  const sourceDriveId = item.remoteItem?.parentReference?.driveId ?? null;
  const sourceItemId = item.remoteItem?.id ?? null;
  const quickXorHash = getOneDriveQuickXorHash(item);
  const sha1Hash = getOneDriveSha1Hash(item);
  const crc32Hash = getOneDriveCrc32Hash(item);
  const sharePointUniqueId =
    item.remoteItem?.sharepointIds?.listItemUniqueId ??
    item.sharepointIds?.listItemUniqueId ??
    null;
  const sourceKey = sharePointUniqueId
    ? `sharepoint:${sharePointUniqueId}`
    : sourceDriveId && sourceItemId
      ? `drive:${sourceDriveId}:item:${sourceItemId}`
      : null;

  return {
    cTag: item.cTag ?? null,
    driveId,
    eTag: item.eTag ?? null,
    filename: remote?.name ?? item.name,
    id: item.id,
    mimeType: item.file?.mimeType ?? remote?.file?.mimeType ?? null,
    modifiedAt: item.lastModifiedDateTime ?? null,
    path: remote?.parentReference?.path ?? item.parentReference?.path ?? null,
    size: remote?.size ?? item.size ?? null,
    quickXorHash,
    sha1Hash,
    crc32Hash,
    sourceDriveId,
    sourceItemId,
    sourceKey,
    sharePointUniqueId,
    webUrl: remote?.webUrl ?? item.webUrl ?? null,
  };
}

async function findOneDriveSharedDuplicateImport(
  sourceKey: null | string,
  currentImportId: string
): Promise<null | { filename: string; sourceImportId: string }> {
  if (!sourceKey) return null;

  const result = await sql<{ filename: string; sourceImportId: string }>`
    SELECT
      coalesce(duplicate_of_import_id, id) AS "sourceImportId",
      filename
    FROM clinical_skin_test_imports
    WHERE onedrive_source_key = ${sourceKey}
      AND id <> ${currentImportId}
    ORDER BY
      CASE status
        WHEN 'IMPORTED' THEN 0
        WHEN 'PENDING_REVIEW' THEN 1
        WHEN 'DISCOVERED' THEN 2
        WHEN 'SKIPPED' THEN 3
        WHEN 'TEMPLATE' THEN 4
        ELSE 5
      END,
      created_at ASC
    LIMIT 1
  `.execute(kysely);

  return result.rows[0] ?? null;
}

function getOneDriveSharedDuplicateIssue(sourceFilename: string): SkinTestIssue {
  return {
    code: "duplicate_onedrive_shared_file",
    message: `Este XLSX apunta al mismo archivo compartido de OneDrive que ${sourceFilename}; se omite para no procesar el mismo archivo desde otra cuenta.`,
    severity: "info",
  };
}

function getOneDriveQuickXorHashDuplicateIssue(sourceFilename: string): SkinTestIssue {
  return {
    code: "duplicate_onedrive_quickxorhash",
    message: `Este XLSX comparte quickXorHash con ${sourceFilename}; se omite porque parece ser el mismo contenido desde otra cuenta o un duplicado renombrado.`,
    severity: "info",
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
        i.duplicate_of_import_id AS "duplicateOfImportId",
        i.error,
        i.issues,
        i.parsed_payload AS "parsedPayload",
        i.modified_at AS "modifiedAt",
        i.onedrive_web_url AS "oneDriveWebUrl",
        i.reviewed_at AS "reviewedAt",
        i.review_notes AS "reviewNotes",
        i.imported_at AS "importedAt",
        i.updated_at AS "updatedAt",
        i.workbook_snapshot_status AS "workbookSnapshotStatus",
        i.workbook_snapshot_error AS "workbookSnapshotError",
        i.workbook_snapshot_archived_at AS "workbookSnapshotArchivedAt",
        wf.extractor_version AS "workbookSnapshotExtractorVersion",
        wf.sha256 AS "workbookSnapshotSha256",
        wf.sheet_name AS "workbookSnapshotSheetName",
        wf.cell_count AS "workbookSnapshotCellCount",
        wf.merge_count AS "workbookSnapshotMergeCount",
        wf.text_hash AS "workbookSnapshotTextHash",
        ws.updated_at AS "workbookSnapshotUpdatedAt",
        t.id AS "skinTestId",
        t.clinical_series_id AS "matchedSeriesId"
      FROM clinical_skin_test_imports i
      LEFT JOIN onedrive_accounts a ON a.account_id = i.onedrive_account_id
      LEFT JOIN clinical_skin_tests t ON t.source_import_id = i.id
      LEFT JOIN clinical_skin_test_workbook_snapshots ws ON ws.source_import_id = i.id
      LEFT JOIN clinical_skin_test_workbook_files wf ON wf.id = ws.workbook_file_id
      WHERE ${whereSql}
      ORDER BY ${input.sortBy === "testDate"
        ? sql`(i.parsed_payload->'header'->>'testDate')::date DESC NULLS LAST, i.updated_at DESC`
        : sql`i.updated_at DESC`}
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

export async function getSkinTestAnalytics(
  input: SkinTestAnalyticsInput = {}
): Promise<SkinTestAnalyticsOutput> {
  const pageSize = input.pageSize ?? 20;
  const whereSql = buildSkinTestAnalyticsWhereSql(input);
  const examTypeSql = skinTestExamTypeSql();

  const [
    summaryResult,
    byExamTypeResult,
    byMonthResult,
    topPatientsResult,
    topAllergensResult,
    allergenCatalogResult,
    recentTestsResult,
  ] = await Promise.all([
      sql<{
        dateFrom: Date | string | null;
        dateTo: Date | string | null;
        patientsWithPositiveAllergen: number;
        positiveAllergenResults: number;
        positiveTests: number;
        totalPatients: number;
        totalResults: number;
        totalTests: number;
        withRut: number;
        withoutRut: number;
      }>`
        WITH filtered AS (
          SELECT t.*
          FROM clinical_skin_tests t
          LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
          WHERE ${whereSql}
        )
        SELECT
          count(*)::int AS "totalTests",
          count(DISTINCT coalesce(nullif(patient_rut, ''), nullif(patient_name, ''), id))::int AS "totalPatients",
          count(*) FILTER (WHERE nullif(patient_rut, '') IS NOT NULL)::int AS "withRut",
          count(*) FILTER (WHERE nullif(patient_rut, '') IS NULL)::int AS "withoutRut",
          min(test_date) AS "dateFrom",
          max(test_date) AS "dateTo",
          coalesce((SELECT count(*)::int FROM clinical_skin_test_results r WHERE r.skin_test_id IN (SELECT id FROM filtered)), 0) AS "totalResults",
          coalesce((
            SELECT count(*)::int
            FROM clinical_skin_test_results r
            WHERE r.skin_test_id IN (SELECT id FROM filtered)
              AND r.control_type IS NULL
              AND coalesce(r.papule_mm, 0) >= 3
          ), 0) AS "positiveAllergenResults",
          coalesce((
            SELECT count(DISTINCT r.skin_test_id)::int
            FROM clinical_skin_test_results r
            WHERE r.skin_test_id IN (SELECT id FROM filtered)
              AND r.control_type IS NULL
              AND coalesce(r.papule_mm, 0) >= 3
          ), 0) AS "positiveTests",
          coalesce((
            SELECT count(DISTINCT coalesce(nullif(f.patient_rut, ''), nullif(f.patient_name, ''), f.clinical_series_id::text, f.id))::int
            FROM filtered f
            JOIN clinical_skin_test_results r ON r.skin_test_id = f.id
            WHERE r.control_type IS NULL
              AND coalesce(r.papule_mm, 0) >= 3
          ), 0) AS "patientsWithPositiveAllergen"
        FROM filtered
      `.execute(kysely),
      sql<{ examType: string; total: number }>`
        SELECT ${examTypeSql} AS "examType", count(*)::int AS total
        FROM clinical_skin_tests t
        LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
        WHERE ${whereSql}
        GROUP BY "examType"
        ORDER BY total DESC, "examType" ASC
      `.execute(kysely),
      sql<{ month: string; total: number }>`
        SELECT to_char(date_trunc('month', t.test_date), 'YYYY-MM') AS month, count(*)::int AS total
        FROM clinical_skin_tests t
        LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
        WHERE ${whereSql}
        GROUP BY month
        ORDER BY month DESC
        LIMIT 24
      `.execute(kysely),
      sql<{
        lastTestDate: Date | string | null;
        patientName: string | null;
        patientRut: string | null;
        totalTests: number;
      }>`
        SELECT
          nullif(t.patient_name, '') AS "patientName",
          nullif(t.patient_rut, '') AS "patientRut",
          count(*)::int AS "totalTests",
          max(t.test_date) AS "lastTestDate"
        FROM clinical_skin_tests t
        LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
        WHERE ${whereSql}
        GROUP BY nullif(t.patient_name, ''), nullif(t.patient_rut, '')
        ORDER BY "totalTests" DESC, "lastTestDate" DESC NULLS LAST
        LIMIT 12
      `.execute(kysely),
      sql<{
        allergenName: string;
        code: string | null;
        papuleMm: number | null;
        patientKey: string;
        section: string;
        skinTestId: string;
      }>`
        SELECT
          r.section,
          r.code,
          r.allergen_name AS "allergenName",
          r.papule_mm::float AS "papuleMm",
          t.id AS "skinTestId",
          coalesce(nullif(t.patient_rut, ''), nullif(t.patient_name, ''), t.clinical_series_id::text, t.id) AS "patientKey"
        FROM clinical_skin_test_results r
        JOIN clinical_skin_tests t ON t.id = r.skin_test_id
        LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
        WHERE ${whereSql}
          AND r.control_type IS NULL
          AND coalesce(r.papule_mm, 0) >= 3
      `.execute(kysely),
      sql<ClinicalAllergenCatalogRow>`
        SELECT
          a.id AS "allergenId",
          a.scientific_name AS "scientificName",
          a.common_name AS "commonName",
          a.english_name AS "englishName",
          a.category,
          a.pollen_type AS "pollenType",
          aa.normalized_alias AS "normalizedAlias",
          aa.alias_type AS "aliasType"
        FROM clinical_allergen_aliases aa
        JOIN clinical_allergens a ON a.id = aa.allergen_id
        WHERE a.is_active = true
      `.execute(kysely),
      sql<{
        clinicalSeriesId: number;
        examType: string;
        id: string;
        oneDriveWebUrl: string | null;
        panelTitle: string | null;
        patientName: string | null;
        patientRut: string | null;
        resultCount: number;
        testDate: Date | string;
      }>`
        SELECT
          t.id,
          t.clinical_series_id AS "clinicalSeriesId",
          t.test_date AS "testDate",
          t.patient_name AS "patientName",
          t.patient_rut AS "patientRut",
          t.panel_title AS "panelTitle",
          i.onedrive_web_url AS "oneDriveWebUrl",
          ${examTypeSql} AS "examType",
          count(r.id)::int AS "resultCount"
        FROM clinical_skin_tests t
        LEFT JOIN clinical_skin_test_imports i ON i.id = t.source_import_id
        LEFT JOIN clinical_skin_test_results r ON r.skin_test_id = t.id
        WHERE ${whereSql}
        GROUP BY t.id, i.onedrive_web_url, "examType"
        ORDER BY t.test_date DESC, t.created_at DESC
        LIMIT ${pageSize}
      `.execute(kysely),
    ]);

  const summary = summaryResult.rows[0];
  return {
    byExamType: byExamTypeResult.rows,
    byMonth: byMonthResult.rows.reverse(),
    dateFrom: summary?.dateFrom ? toDateString(summary.dateFrom) : null,
    dateTo: summary?.dateTo ? toDateString(summary.dateTo) : null,
    patientsWithPositiveAllergen: summary?.patientsWithPositiveAllergen ?? 0,
    positiveAllergenResults: summary?.positiveAllergenResults ?? 0,
    positiveTests: summary?.positiveTests ?? 0,
    recentTests: recentTestsResult.rows.map((row) => ({
      ...row,
      testDate: toDateString(row.testDate),
    })),
    topPatients: topPatientsResult.rows.map((row) => ({
      ...row,
      lastTestDate: row.lastTestDate ? toDateString(row.lastTestDate) : null,
    })),
    topAllergens: aggregateTopAllergens(
      topAllergensResult.rows,
      buildAllergenCatalogMap(allergenCatalogResult.rows)
    ),
    totalPatients: summary?.totalPatients ?? 0,
    totalResults: summary?.totalResults ?? 0,
    totalTests: summary?.totalTests ?? 0,
    withRut: summary?.withRut ?? 0,
    withoutRut: summary?.withoutRut ?? 0,
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
      i.duplicate_of_import_id AS "duplicateOfImportId",
      i.error,
      i.issues,
      i.parsed_payload AS "parsedPayload",
      i.modified_at AS "modifiedAt",
      i.onedrive_web_url AS "oneDriveWebUrl",
      i.reviewed_at AS "reviewedAt",
      i.review_notes AS "reviewNotes",
      i.imported_at AS "importedAt",
      i.updated_at AS "updatedAt",
      i.workbook_snapshot_status AS "workbookSnapshotStatus",
      i.workbook_snapshot_error AS "workbookSnapshotError",
      i.workbook_snapshot_archived_at AS "workbookSnapshotArchivedAt",
      wf.extractor_version AS "workbookSnapshotExtractorVersion",
      wf.sha256 AS "workbookSnapshotSha256",
      wf.sheet_name AS "workbookSnapshotSheetName",
      wf.cell_count AS "workbookSnapshotCellCount",
      wf.merge_count AS "workbookSnapshotMergeCount",
      wf.text_hash AS "workbookSnapshotTextHash",
      ws.updated_at AS "workbookSnapshotUpdatedAt",
      t.id AS "skinTestId",
      t.clinical_series_id AS "matchedSeriesId"
    FROM clinical_skin_test_imports i
    LEFT JOIN onedrive_accounts a ON a.account_id = i.onedrive_account_id
    LEFT JOIN clinical_skin_tests t ON t.source_import_id = i.id
    LEFT JOIN clinical_skin_test_workbook_snapshots ws ON ws.source_import_id = i.id
    LEFT JOIN clinical_skin_test_workbook_files wf ON wf.id = ws.workbook_file_id
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
    oneDriveCTag: string | null;
    oneDriveETag: string | null;
    size: number | null;
  }>`
    SELECT
      onedrive_drive_id AS "oneDriveDriveId",
      onedrive_item_id AS "oneDriveItemId",
      onedrive_account_id AS "oneDriveAccountId",
      onedrive_ctag AS "oneDriveCTag",
      onedrive_etag AS "oneDriveETag",
      size
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
  const snapshotResult = await persistSkinTestWorkbookSnapshot({
    buffer,
    importId: id,
    sourceCTag: result.rows[0]?.oneDriveCTag,
    sourceETag: result.rows[0]?.oneDriveETag,
    sourceSizeBytes: result.rows[0]?.size,
  });

  const sha256Duplicate = await findWorkbookSha256DuplicateImport(snapshotResult.sha256, id);
  if (sha256Duplicate) {
    await sql`
      UPDATE clinical_skin_test_imports
      SET parser_version = ${SKIN_TEST_PARSER_VERSION},
          status = 'SKIPPED',
          confidence = 0,
          error = null,
          issues = ${JSON.stringify([getWorkbookSha256DuplicateIssue(sha256Duplicate.filename)])}::jsonb,
          parsed_payload = null,
          result_hash = null,
          duplicate_of_import_id = ${sha256Duplicate.sourceImportId},
          updated_at = now()
      WHERE id = ${id}
    `.execute(kysely);
    return await getSkinTestImport(id);
  }

  const parsed = await parseSkinTestWorkbookBuffer(
    buffer
  );
  const resultHash = computeResultHash(parsed.results);
  const templateIssue = getTemplateSkinTestIssue(parsed);
  if (templateIssue) {
    await sql`
      UPDATE clinical_skin_test_imports
      SET parser_version = ${SKIN_TEST_PARSER_VERSION},
          status = 'TEMPLATE',
          confidence = 0,
          error = null,
          issues = ${JSON.stringify([templateIssue])}::jsonb,
          parsed_payload = ${JSON.stringify({ header: parsed.header, interpretation: parsed.interpretation, results: parsed.results })}::jsonb,
          result_hash = ${resultHash},
          duplicate_of_import_id = null,
          updated_at = now()
      WHERE id = ${id}
    `.execute(kysely);
    return await getSkinTestImport(id);
  }

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

export async function archiveMissingSkinTestWorkbookSnapshots(options?: {
  accountId?: string;
  dryRun?: boolean;
  importStatus?: SkinTestImportStatus;
  limit?: number;
  onlyChanged?: boolean;
  onlyMissing?: boolean;
  onProgress?: (progress: SkinTestSyncProgress & { message: string }) => void;
  query?: string;
  shouldCancel?: () => boolean;
}) {
  const requestedLimit = Math.max(options?.limit ?? ARCHIVE_BATCH_SIZE, 1);
  const unlimited = requestedLimit > ARCHIVE_UNLIMITED_THRESHOLD;
  const concurrency = resolveArchiveConcurrency();
  const query = options?.query?.trim();

  type ArchiveRow = {
    filename: string;
    id: string;
    oneDriveAccountId: string | null;
    oneDriveCTag: string | null;
    oneDriveDriveId: string | null;
    oneDriveETag: string | null;
    oneDriveItemId: string;
    size: number | null;
  };

  const fetchRows = async (batchLimit: number, excludeIds: string[]): Promise<ArchiveRow[]> => {
    const excludeCondition =
      excludeIds.length > 0
        ? sql`AND i.id != ALL(ARRAY[${sql.join(excludeIds.map((id) => sql`${id}`))}]::text[])`
        : sql``;
    return (
      await sql<ArchiveRow>`
        SELECT
          i.id,
          i.filename,
          i.onedrive_account_id AS "oneDriveAccountId",
          i.onedrive_item_id AS "oneDriveItemId",
          i.onedrive_drive_id AS "oneDriveDriveId",
          i.onedrive_etag AS "oneDriveETag",
          i.onedrive_ctag AS "oneDriveCTag",
          i.size
        FROM clinical_skin_test_imports i
        LEFT JOIN clinical_skin_test_workbook_snapshots s ON s.source_import_id = i.id
        WHERE i.onedrive_account_id IS NOT NULL
          AND (${options?.accountId ?? null}::text IS NULL OR i.onedrive_account_id = ${options?.accountId ?? null})
          AND (${options?.importStatus ?? null}::text IS NULL OR i.status = ${options?.importStatus ?? null}::"ClinicalSkinTestImportStatus")
          AND (
            ${query ?? null}::text IS NULL
            OR i.filename ILIKE ${`%${query ?? ""}%`}
            OR i.path ILIKE ${`%${query ?? ""}%`}
            OR i.parsed_payload->'header'->>'patientName' ILIKE ${`%${query ?? ""}%`}
            OR i.parsed_payload->'header'->>'patientRut' ILIKE ${`%${query ?? ""}%`}
          )
          AND (
            CASE
              WHEN ${options?.onlyMissing ?? false}::boolean THEN s.id IS NULL
              WHEN ${options?.onlyChanged ?? false}::boolean THEN s.id IS NOT NULL AND (
                s.source_etag IS DISTINCT FROM i.onedrive_etag
                OR s.source_ctag IS DISTINCT FROM i.onedrive_ctag
              )
              ELSE s.id IS NULL
                OR s.source_etag IS DISTINCT FROM i.onedrive_etag
                OR s.source_ctag IS DISTINCT FROM i.onedrive_ctag
            END
          )
          ${excludeCondition}
        ORDER BY i.updated_at DESC
        LIMIT ${batchLimit}
      `.execute(kysely)
    ).rows;
  };

  const initialRows = await fetchRows(unlimited ? ARCHIVE_BATCH_SIZE : requestedLimit, []);

  // In unlimited mode total grows as we drain the queue; start with first-batch count
  let total = initialRows.length;
  let archived = 0;
  let downloadedBytes = 0;
  let errors = 0;
  let skipped = 0;
  const erroredIds: string[] = [];

  const emit = (message: string, processed: number, filename?: string) => {
    options?.onProgress?.({
      archived,
      downloadedBytes,
      dryRun: options?.dryRun ?? false,
      errors,
      failed: errors,
      filesProcessed: processed,
      filesTotal: total,
      filename,
      phase: "archiving",
      processed,
      skipped,
      total,
      message,
    });
  };

  emit(
    options?.dryRun
      ? `Encontrados ${total} snapshot(s) candidato(s)`
      : `Preparando ${total} snapshot(s) candidato(s)`,
    0
  );

  if (options?.dryRun) {
    return { archived: 0, downloadedBytes: 0, dryRun: true, errors: 0, processed: 0, skipped: total, total };
  }

  const processRows = async (rows: ArchiveRow[]) => {
    let cursor = 0;
    const workerCount = Math.min(concurrency, rows.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        if (options?.shouldCancel?.()) throw new Error("SYNC_CANCELLED");
        const index = cursor;
        if (index >= rows.length) return;
        cursor += 1;

        const row = rows[index];
        const done = archived + errors + skipped;
        emit(`Archivando ${done + 1}/${total}: ${row.filename}`, done, row.filename);

        if (!row.oneDriveAccountId) {
          skipped += 1;
          continue;
        }

        try {
          const buffer = await downloadOneDriveItem(
            row.oneDriveAccountId,
            row.oneDriveItemId,
            row.oneDriveDriveId
          );
          const snapshotResult = await persistSkinTestWorkbookSnapshot({
            buffer,
            importId: row.id,
            sourceCTag: row.oneDriveCTag,
            sourceETag: row.oneDriveETag,
            sourceSizeBytes: row.size,
          });
          downloadedBytes += buffer.byteLength;
          archived += 1;
          emit(
            `Archivado ${archived + errors + skipped}/${total}: ${snapshotResult.cellCount} celdas`,
            archived + errors + skipped,
            row.filename
          );
        } catch (error) {
          errors += 1;
          erroredIds.push(row.id);
          await sql`
            UPDATE clinical_skin_test_imports
            SET workbook_snapshot_status = 'ERROR',
                workbook_snapshot_error = ${error instanceof Error ? error.message : String(error)},
                updated_at = now()
            WHERE id = ${row.id}
          `.execute(kysely);
          emit(
            `Error ${archived + errors + skipped}/${total}: ${row.filename}`,
            archived + errors + skipped,
            row.filename
          );
        }
      }
    });
    await Promise.all(workers);
  };

  if (unlimited) {
    let currentBatch = initialRows;
    while (currentBatch.length > 0) {
      await processRows(currentBatch);
      if (options?.shouldCancel?.()) throw new Error("SYNC_CANCELLED");
      currentBatch = await fetchRows(ARCHIVE_BATCH_SIZE, erroredIds);
      // Update running total so progress display stays accurate
      total = archived + errors + skipped + currentBatch.length;
    }
  } else {
    await processRows(initialRows);
  }

  return { archived, downloadedBytes, errors, processed: archived + errors + skipped, skipped, total };
}

export async function processDiscoveredSkinTestImports(options?: {
  onProgress?: (progress: SkinTestSyncProgress & { message: string }) => void;
  query?: string;
  shouldCancel?: () => boolean;
}) {
  const idsResult = await sql<{ id: string; filename: string }>`
    SELECT i.id, i.filename
    FROM clinical_skin_test_imports i
    WHERE ${buildImportWhereSql({ query: options?.query, status: "DISCOVERED" })}
    ORDER BY i.updated_at ASC
  `.execute(kysely);

  const total = idsResult.rows.length;
  let imported = 0;
  let pending = 0;
  let skipped = 0;
  let errors = 0;

  const emit = (message: string, processed: number, filename?: string) => {
    options?.onProgress?.({
      errors,
      failed: errors,
      filesProcessed: processed,
      filesTotal: total,
      filename,
      imported,
      pending,
      phase: "discovered-processing",
      processed,
      skipped,
      total,
      message,
    });
  };

  emit(`Preparando ${total} descubierto(s)`, 0);

  for (const [index, row] of idsResult.rows.entries()) {
    if (options?.shouldCancel?.()) {
      throw new Error("SYNC_CANCELLED");
    }

    emit(`Procesando ${index + 1}/${total}: ${row.filename}`, index, row.filename);
    try {
      const result = await reprocessSkinTestImport(row.id);
      if (result.status === "IMPORTED") imported += 1;
      else if (result.status === "PENDING_REVIEW") pending += 1;
      else if (result.status === "SKIPPED" || result.status === "TEMPLATE") skipped += 1;
      else if (result.status === "ERROR") errors += 1;
    } catch (error) {
      errors += 1;
      await sql`
        UPDATE clinical_skin_test_imports
        SET status = 'ERROR',
            error = ${error instanceof Error ? error.message : String(error)},
            updated_at = now()
        WHERE id = ${row.id}
      `.execute(kysely);
    }
    emit(`Procesados ${index + 1}/${total}`, index + 1, row.filename);
  }

  return { errors, imported, pending, processed: total, skipped, total };
}

export async function reprocessPendingSkinTestImports(options?: {
  onProgress?: (progress: SkinTestSyncProgress & { message: string }) => void;
  query?: string;
  shouldCancel?: () => boolean;
}) {
  const idsResult = await sql<{ id: string; filename: string }>`
    SELECT i.id, i.filename
    FROM clinical_skin_test_imports i
    WHERE ${buildImportWhereSql({ query: options?.query, status: "PENDING_REVIEW" })}
    ORDER BY i.updated_at ASC
  `.execute(kysely);

  const total = idsResult.rows.length;
  let imported = 0;
  let pending = 0;
  let skipped = 0;
  let errors = 0;

  const emit = (message: string, processed: number, filename?: string) => {
    options?.onProgress?.({
      errors,
      failed: errors,
      filesProcessed: processed,
      filesTotal: total,
      filename,
      imported,
      pending,
      phase: "pending-reprocessing",
      processed,
      skipped,
      total,
      message,
    });
  };

  emit(`Preparando ${total} pendiente(s)`, 0);

  for (const [index, row] of idsResult.rows.entries()) {
    if (options?.shouldCancel?.()) {
      throw new Error("SYNC_CANCELLED");
    }

    emit(`Procesando ${index + 1}/${total}: ${row.filename}`, index, row.filename);
    try {
      const result = await reprocessSkinTestImport(row.id);
      if (result.status === "IMPORTED") imported += 1;
      else if (result.status === "PENDING_REVIEW") pending += 1;
      else if (result.status === "SKIPPED" || result.status === "TEMPLATE") skipped += 1;
      else if (result.status === "ERROR") errors += 1;
    } catch (error) {
      errors += 1;
      await sql`
        UPDATE clinical_skin_test_imports
        SET status = 'ERROR',
            error = ${error instanceof Error ? error.message : String(error)},
            updated_at = now()
        WHERE id = ${row.id}
      `.execute(kysely);
    }
    emit(`Procesados ${index + 1}/${total}`, index + 1, row.filename);
  }

  return { errors, imported, pending, processed: total, skipped, total };
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
  if (!testDate) {
    return { issues, seriesId: null };
  }

  if (patientRut) {
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
  } else if (patientName) {
    const nameMatch = await matchClinicalSeriesByNameAndDate(patientName, testDate);
    if (nameMatch.seriesId || nameMatch.issues.length > 0) return nameMatch;
  }

  if (!options.allowCreate) {
    return {
      issues: [
        {
          code: "series_pending_review",
          message: patientRut
            ? "No hay serie clínica existente; se creará al aprobar la importación."
            : "No hay RUT en el archivo; se resolverá por nombre al aprobar la importación.",
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
      ${patientName ?? `Test cutáneo ${patientRut ?? testDate}`},
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

async function matchClinicalSeriesByNameAndDate(
  patientName: string,
  testDate: string
): Promise<MatchResult> {
  const normalizedPatientName = normalizeDocumentName(patientName);
  if (!normalizedPatientName) return { issues: [], seriesId: null };

  const result = await sql<{ id: number; patientName: null | string }>`
    SELECT cs.id, cs.patient_name AS "patientName"
    FROM clinical_series cs
    LEFT JOIN events e ON e.clinical_series_id = cs.id
    WHERE cs.kind = 'SKIN_TEST'
      AND cs.patient_name IS NOT NULL
      AND (
        e.id IS NULL
        OR e.start_date = ${testDate}::date
        OR e.start_date BETWEEN (${testDate}::date - interval '14 days') AND (${testDate}::date + interval '14 days')
      )
    GROUP BY cs.id, cs.patient_name
    ORDER BY min(abs(coalesce(e.start_date, ${testDate}::date) - ${testDate}::date)) NULLS LAST, cs.id DESC
    LIMIT 100
  `.execute(kysely);

  const matches = result.rows.filter(
    (row) => normalizeDocumentName(row.patientName ?? "") === normalizedPatientName
  );
  if (matches.length === 1) return { issues: [], seriesId: matches[0]?.id ?? null };
  if (matches.length > 1) {
    return {
      issues: [
        {
          code: "multiple_series_candidates",
          message: "Hay más de una serie clínica candidata para este nombre y fecha.",
          severity: "error",
        },
      ],
      seriesId: null,
    };
  }
  return { issues: [], seriesId: null };
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

  // Deduplicate by conflict key before batch insert — parser can emit duplicate (section, code, allergenName)
  const seenResultKeys = new Map<string, (typeof parsed.results)[number]>();
  for (const r of parsed.results) {
    seenResultKeys.set(`${r.section}|${r.code ?? ""}|${r.allergenName}`, r);
  }
  const dedupedResults = [...seenResultKeys.values()];

  // Batch insert results — one query per chunk instead of one per row.
  for (let i = 0; i < dedupedResults.length; i += RESULTS_BATCH_SIZE) {
    const chunk = dedupedResults.slice(i, i + RESULTS_BATCH_SIZE);
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
    ImportRow & { oneDriveCTag: null | string; oneDriveETag: null | string; oneDriveQuickXorHash: null | string }
  >`
    SELECT
      i.*,
      i.onedrive_account_id AS "oneDriveAccountId",
      a.email AS "accountEmail",
      a.name AS "accountName",
      i.duplicate_of_import_id AS "duplicateOfImportId",
      i.onedrive_etag AS "oneDriveETag",
      i.onedrive_ctag AS "oneDriveCTag",
      i.onedrive_quick_xor_hash AS "oneDriveQuickXorHash",
      i.parsed_payload AS "parsedPayload",
      i.modified_at AS "modifiedAt",
      i.onedrive_web_url AS "oneDriveWebUrl",
      i.reviewed_at AS "reviewedAt",
      i.review_notes AS "reviewNotes",
      i.imported_at AS "importedAt",
      i.updated_at AS "updatedAt",
      i.workbook_snapshot_status AS "workbookSnapshotStatus",
      i.workbook_snapshot_error AS "workbookSnapshotError",
      i.workbook_snapshot_archived_at AS "workbookSnapshotArchivedAt",
      wf.extractor_version AS "workbookSnapshotExtractorVersion",
      wf.sha256 AS "workbookSnapshotSha256",
      wf.sheet_name AS "workbookSnapshotSheetName",
      wf.cell_count AS "workbookSnapshotCellCount",
      wf.merge_count AS "workbookSnapshotMergeCount",
      wf.text_hash AS "workbookSnapshotTextHash",
      ws.updated_at AS "workbookSnapshotUpdatedAt"
    FROM clinical_skin_test_imports i
    LEFT JOIN onedrive_accounts a ON a.account_id = i.onedrive_account_id
    LEFT JOIN clinical_skin_test_workbook_snapshots ws ON ws.source_import_id = i.id
    LEFT JOIN clinical_skin_test_workbook_files wf ON wf.id = ws.workbook_file_id
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

async function getClinicalXlsxFileByOneDriveItemId(
  accountId: string,
  driveId: string,
  itemId: string
) {
  const result = await sql<{
    classification: ClinicalXlsxFileClassification;
    id: string;
    oneDriveCTag: null | string;
    oneDriveETag: null | string;
  }>`
    SELECT
      id,
      classification,
      onedrive_etag AS "oneDriveETag",
      onedrive_ctag AS "oneDriveCTag"
    FROM clinical_xlsx_files
    WHERE onedrive_account_id = ${accountId}
      AND onedrive_drive_id = ${driveId}
      AND onedrive_item_id = ${itemId}
  `.execute(kysely);
  return result.rows[0] ?? null;
}

async function upsertClinicalXlsxFile(params: {
  accountId: string;
  classification: {
    classification: ClinicalXlsxFileClassification;
    reason: string;
  };
  id: string;
  metadata: OneDriveItemMetadata;
}) {
  await sql`
    INSERT INTO clinical_xlsx_files (
      id,
      onedrive_account_id,
      onedrive_item_id,
      onedrive_drive_id,
      onedrive_source_key,
      onedrive_source_drive_id,
      onedrive_source_item_id,
      onedrive_sharepoint_unique_id,
      onedrive_etag,
      onedrive_ctag,
      onedrive_web_url,
      path,
      filename,
      mime_type,
      size,
      modified_at,
      classification,
      classification_reason,
      created_at,
      updated_at
    )
    VALUES (
      ${params.id},
      ${params.accountId},
      ${params.metadata.id},
      ${params.metadata.driveId},
      ${params.metadata.sourceKey},
      ${params.metadata.sourceDriveId},
      ${params.metadata.sourceItemId},
      ${params.metadata.sharePointUniqueId},
      ${params.metadata.eTag},
      ${params.metadata.cTag},
      ${params.metadata.webUrl},
      ${params.metadata.path},
      ${params.metadata.filename},
      ${params.metadata.mimeType},
      ${params.metadata.size},
      ${params.metadata.modifiedAt}::timestamptz,
      ${params.classification.classification}::"ClinicalXlsxFileClassification",
      ${params.classification.reason},
      now(),
      now()
    )
    ON CONFLICT (onedrive_account_id, onedrive_drive_id, onedrive_item_id)
    DO UPDATE SET
      onedrive_source_key = EXCLUDED.onedrive_source_key,
      onedrive_source_drive_id = EXCLUDED.onedrive_source_drive_id,
      onedrive_source_item_id = EXCLUDED.onedrive_source_item_id,
      onedrive_sharepoint_unique_id = EXCLUDED.onedrive_sharepoint_unique_id,
      onedrive_etag = EXCLUDED.onedrive_etag,
      onedrive_ctag = EXCLUDED.onedrive_ctag,
      onedrive_web_url = EXCLUDED.onedrive_web_url,
      path = EXCLUDED.path,
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      modified_at = EXCLUDED.modified_at,
      classification = EXCLUDED.classification,
      classification_reason = EXCLUDED.classification_reason,
      updated_at = now()
  `.execute(kysely);
}

async function upsertImport(params: {
  accountId: string;
  confidence: number;
  duplicateOfImportId?: null | string;
  error: null | string;
  id: string;
  issues: SkinTestIssue[];
  metadata: OneDriveItemMetadata;
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
      onedrive_source_key,
      onedrive_source_drive_id,
      onedrive_source_item_id,
      onedrive_sharepoint_unique_id,
      onedrive_quick_xor_hash,
      onedrive_sha1_hash,
      onedrive_crc32_hash,
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
      ${params.metadata.sourceKey},
      ${params.metadata.sourceDriveId},
      ${params.metadata.sourceItemId},
      ${params.metadata.sharePointUniqueId},
      ${params.metadata.quickXorHash},
      ${params.metadata.sha1Hash},
      ${params.metadata.crc32Hash},
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
      onedrive_source_key = EXCLUDED.onedrive_source_key,
      onedrive_source_drive_id = EXCLUDED.onedrive_source_drive_id,
      onedrive_source_item_id = EXCLUDED.onedrive_source_item_id,
      onedrive_sharepoint_unique_id = EXCLUDED.onedrive_sharepoint_unique_id,
      onedrive_quick_xor_hash = EXCLUDED.onedrive_quick_xor_hash,
      onedrive_sha1_hash = EXCLUDED.onedrive_sha1_hash,
      onedrive_crc32_hash = EXCLUDED.onedrive_crc32_hash,
      onedrive_etag = EXCLUDED.onedrive_etag,
      onedrive_ctag = EXCLUDED.onedrive_ctag,
      onedrive_web_url = EXCLUDED.onedrive_web_url,
      path = EXCLUDED.path,
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      modified_at = EXCLUDED.modified_at,
      workbook_snapshot_status = CASE
        WHEN clinical_skin_test_imports.workbook_snapshot_status = 'ARCHIVED'
          AND (
            clinical_skin_test_imports.onedrive_etag IS DISTINCT FROM EXCLUDED.onedrive_etag
            OR clinical_skin_test_imports.onedrive_ctag IS DISTINCT FROM EXCLUDED.onedrive_ctag
          )
        THEN 'STALE'::"ClinicalSkinTestWorkbookSnapshotStatus"
        ELSE clinical_skin_test_imports.workbook_snapshot_status
      END,
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

async function ensureImportMetadataRow(
  accountId: string,
  importId: string,
  metadata: OneDriveItemMetadata
) {
  await sql`
    INSERT INTO clinical_skin_test_imports (
      id,
      onedrive_account_id,
      onedrive_item_id,
      onedrive_drive_id,
      onedrive_source_key,
      onedrive_source_drive_id,
      onedrive_source_item_id,
      onedrive_sharepoint_unique_id,
      onedrive_quick_xor_hash,
      onedrive_sha1_hash,
      onedrive_crc32_hash,
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
      issues,
      created_at,
      updated_at
    )
    VALUES (
      ${importId},
      ${accountId},
      ${metadata.id},
      ${metadata.driveId},
      ${metadata.sourceKey},
      ${metadata.sourceDriveId},
      ${metadata.sourceItemId},
      ${metadata.sharePointUniqueId},
      ${metadata.quickXorHash},
      ${metadata.sha1Hash},
      ${metadata.crc32Hash},
      ${metadata.eTag},
      ${metadata.cTag},
      ${metadata.webUrl},
      ${metadata.path},
      ${metadata.filename},
      ${metadata.mimeType},
      ${metadata.size},
      ${metadata.modifiedAt}::timestamptz,
      ${SKIN_TEST_PARSER_VERSION},
      'DISCOVERED',
      0,
      '[]'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (onedrive_account_id, onedrive_drive_id, onedrive_item_id)
    DO UPDATE SET
      onedrive_source_key = EXCLUDED.onedrive_source_key,
      onedrive_source_drive_id = EXCLUDED.onedrive_source_drive_id,
      onedrive_source_item_id = EXCLUDED.onedrive_source_item_id,
      onedrive_sharepoint_unique_id = EXCLUDED.onedrive_sharepoint_unique_id,
      onedrive_quick_xor_hash = EXCLUDED.onedrive_quick_xor_hash,
      onedrive_sha1_hash = EXCLUDED.onedrive_sha1_hash,
      onedrive_crc32_hash = EXCLUDED.onedrive_crc32_hash,
      onedrive_etag = EXCLUDED.onedrive_etag,
      onedrive_ctag = EXCLUDED.onedrive_ctag,
      onedrive_web_url = EXCLUDED.onedrive_web_url,
      path = EXCLUDED.path,
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      modified_at = EXCLUDED.modified_at,
      workbook_snapshot_status = CASE
        WHEN clinical_skin_test_imports.workbook_snapshot_status = 'ARCHIVED'
          AND (
            clinical_skin_test_imports.onedrive_etag IS DISTINCT FROM EXCLUDED.onedrive_etag
            OR clinical_skin_test_imports.onedrive_ctag IS DISTINCT FROM EXCLUDED.onedrive_ctag
          )
        THEN 'STALE'::"ClinicalSkinTestWorkbookSnapshotStatus"
        ELSE clinical_skin_test_imports.workbook_snapshot_status
      END,
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
    AND (${input.snapshotStatus ?? null}::text IS NULL OR i.workbook_snapshot_status = ${input.snapshotStatus ?? null}::"ClinicalSkinTestWorkbookSnapshotStatus")
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

function buildSkinTestAnalyticsWhereSql(input: SkinTestAnalyticsInput) {
  const query = input.query?.trim();
  const examType = input.examType?.trim();
  const examTypeSql = skinTestExamTypeSql();
  return sql<boolean>`
    (${input.dateFrom ?? null}::date IS NULL OR t.test_date >= ${input.dateFrom ?? null}::date)
    AND (${input.dateTo ?? null}::date IS NULL OR t.test_date <= ${input.dateTo ?? null}::date)
    AND (${examType || null}::text IS NULL OR ${examTypeSql} = ${examType || null})
    AND (
      ${query ?? null}::text IS NULL
      OR t.patient_name ILIKE ${`%${query ?? ""}%`}
      OR t.patient_rut ILIKE ${`%${query ?? ""}%`}
      OR t.panel_title ILIKE ${`%${query ?? ""}%`}
      OR i.filename ILIKE ${`%${query ?? ""}%`}
    )
  `;
}

function aggregateTopAllergens(
  rows: Array<{
    allergenName: string;
    code: null | string;
    papuleMm: null | number;
    patientKey: string;
    section: string;
    skinTestId: string;
  }>,
  catalogByAlias: Map<string, ClinicalAllergenCatalogEntry>
): SkinTestAnalyticsOutput["topAllergens"] {
  type AllergenBucket = {
    canonicalCode: null | string;
    category: null | string;
    canonicalName: string;
    patientKeys: Set<string>;
    papuleSum: number;
    papuleValues: number[];
    positiveResults: number;
    scientificName: null | string;
    section: string;
    skinTestIds: Set<string>;
  };

  const buckets = new Map<string, AllergenBucket>();
  for (const row of rows) {
    const canonical = canonicalizeAllergen(row, catalogByAlias);
    if (!canonical) continue;

    const existing = buckets.get(canonical.key);
    const bucket =
      existing ??
      {
        canonicalCode: canonical.code,
        category: canonical.category,
        canonicalName: canonical.name,
        patientKeys: new Set<string>(),
        papuleSum: 0,
        papuleValues: [],
        positiveResults: 0,
        scientificName: canonical.scientificName,
        section: canonical.section,
        skinTestIds: new Set<string>(),
      };

    bucket.positiveResults += 1;
    bucket.patientKeys.add(row.patientKey);
    bucket.skinTestIds.add(row.skinTestId);
    if (typeof row.papuleMm === "number" && Number.isFinite(row.papuleMm)) {
      bucket.papuleValues.push(row.papuleMm);
      bucket.papuleSum += row.papuleMm;
    }
    if (!bucket.canonicalCode && canonical.code) {
      bucket.canonicalCode = canonical.code;
    }
    buckets.set(canonical.key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => {
      const maxPapuleMm = bucket.papuleValues.length > 0 ? Math.max(...bucket.papuleValues) : null;
      const avgPapuleMm =
        bucket.papuleValues.length > 0
          ? Math.round((bucket.papuleSum / bucket.papuleValues.length) * 10) / 10
          : null;
      return {
        allergenName: bucket.canonicalName,
        avgPapuleMm,
        category: bucket.category,
        code: bucket.canonicalCode,
        maxPapuleMm,
        positiveResults: bucket.positiveResults,
        scientificName: bucket.scientificName,
        section: bucket.section,
        testCount: bucket.skinTestIds.size,
        uniquePatients: bucket.patientKeys.size,
      };
    })
    .sort((a, b) => {
      if (b.uniquePatients !== a.uniquePatients) return b.uniquePatients - a.uniquePatients;
      if (b.positiveResults !== a.positiveResults) return b.positiveResults - a.positiveResults;
      if ((b.maxPapuleMm ?? 0) !== (a.maxPapuleMm ?? 0)) {
        return (b.maxPapuleMm ?? 0) - (a.maxPapuleMm ?? 0);
      }
      return a.allergenName.localeCompare(b.allergenName, "es");
    })
    .slice(0, 20);
}

function canonicalizeAllergen(
  row: {
    allergenName: string;
    code: null | string;
    section: string;
  },
  catalogByAlias: Map<string, ClinicalAllergenCatalogEntry>
): null | {
  category: null | string;
  code: null | string;
  key: string;
  name: string;
  scientificName: null | string;
  section: string;
} {
  const normalizedName = normalizeAllergenToken(row.allergenName);
  const normalizedCode = normalizeAllergenCode(row.code);
  if (!normalizedName || CONTROL_ALLERGEN_KEYS.has(normalizedName)) return null;

  const isCodeOnlyName = /^[A-Z]{1,3}\d{1,2}$/.test(normalizedName);
  const byName = catalogByAlias.get(normalizedName);
  const byNameCode = isCodeOnlyName ? catalogByAlias.get(normalizedName) : undefined;
  const byCode = normalizedCode ? catalogByAlias.get(normalizedCode) : undefined;
  const canonical = byName ?? byNameCode ?? (isCodeOnlyName ? byCode : undefined);
  if (!canonical) return null;

  const code = canonical.aliasType === "PANEL_CODE" ? canonical.normalizedAlias : normalizedCode;
  return {
    category: canonical.category,
    code,
    key: canonical.allergenId,
    name: canonical.commonName,
    scientificName: canonical.scientificName,
    section: canonical.pollenType ?? canonical.category,
  };
}

function buildAllergenCatalogMap(rows: ClinicalAllergenCatalogRow[]) {
  const map = new Map<string, ClinicalAllergenCatalogEntry>();
  for (const row of rows) {
    map.set(row.normalizedAlias, row);
  }
  return map;
}

function normalizeAllergenToken(value: null | string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeAllergenCode(value: null | string | undefined) {
  const normalized = normalizeAllergenToken(value).replace(/\s+/g, "");
  return /^[A-Z]{1,3}\d{1,2}$/.test(normalized) ? normalized : null;
}

const CONTROL_ALLERGEN_KEYS = new Set([
  "CONTROL NEGATIVO",
  "CONTROL POSITIVO",
  "CONTROL POSITIVO HISTAMINA",
  "CONTROL NEGATIVO GLICEROL SALINO",
]);

function skinTestExamTypeSql() {
  return sql<string>`
    CASE
      WHEN concat_ws(' ', t.panel_title, i.filename) ILIKE '%AINES%' THEN 'AINES'
      WHEN concat_ws(' ', t.panel_title, i.filename) ILIKE '%AEROAL%' THEN 'Aeroalérgenos'
      WHEN concat_ws(' ', t.panel_title, i.filename) ILIKE '%ALIMENT%' THEN 'Alimentario'
      WHEN concat_ws(' ', t.panel_title, i.filename) ILIKE '%ACARO%'
        OR concat_ws(' ', t.panel_title, i.filename) ILIKE '%ÁCARO%' THEN 'Ácaros'
      WHEN concat_ws(' ', t.panel_title, i.filename) ILIKE '%MULTITEST%' THEN 'Multitest'
      WHEN concat_ws(' ', t.panel_title, i.filename) ILIKE '%PRICK%' THEN 'Prick test'
      ELSE 'Sin clasificar'
    END
  `;
}

function isRelevantXlsx(item: OneDriveItem): boolean {
  const name = item.remoteItem?.name ?? item.name;
  if (item.deleted) return false;
  if (!item.file && !item.remoteItem?.file) return false;
  if (!/\.xlsx$/i.test(name)) return false;
  if (/^~\$/.test(name)) return false;
  if (isBlockedDownloadPath(item.parentReference?.path)) return false;
  if (isBlockedDownloadPath(item.remoteItem?.parentReference?.path)) return false;
  return true;
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

interface DuplicateCandidateRow {
  patientName: null | string;
  patientRut: null | string;
  sourceImportId: string;
  sourceRank: number;
  testDate: Date | string;
}

async function findQuickXorHashDuplicateImport(
  quickXorHash: string,
  currentImportId: string
): Promise<null | { filename: string; sourceImportId: string }> {
  const result = await sql<{ filename: string; sourceImportId: string }>`
    SELECT
      coalesce(duplicate_of_import_id, id) AS "sourceImportId",
      filename
    FROM clinical_skin_test_imports
    WHERE onedrive_quick_xor_hash = ${quickXorHash}
      AND id <> ${currentImportId}
    ORDER BY
      CASE status
        WHEN 'IMPORTED' THEN 0
        WHEN 'PENDING_REVIEW' THEN 1
        WHEN 'SKIPPED' THEN 2
        WHEN 'TEMPLATE' THEN 3
        ELSE 4
      END,
      created_at ASC
    LIMIT 1
  `.execute(kysely);

  return result.rows[0] ?? null;
}

async function findWorkbookSha256DuplicateImport(
  sha256: string,
  currentImportId: string
): Promise<null | { filename: string; sourceImportId: string }> {
  const result = await sql<{ filename: string; sourceImportId: string }>`
    SELECT
      coalesce(i.duplicate_of_import_id, i.id) AS "sourceImportId",
      i.filename
    FROM clinical_skin_test_workbook_snapshots ws
    JOIN clinical_skin_test_workbook_files wf ON wf.id = ws.workbook_file_id
    JOIN clinical_skin_test_imports i ON i.id = ws.source_import_id
    WHERE wf.sha256 = ${sha256}
      AND ws.source_import_id <> ${currentImportId}
    ORDER BY
      CASE i.status
        WHEN 'IMPORTED' THEN 0
        WHEN 'PENDING_REVIEW' THEN 1
        WHEN 'SKIPPED' THEN 2
        WHEN 'TEMPLATE' THEN 3
        ELSE 4
      END,
      i.created_at ASC
    LIMIT 1
  `.execute(kysely);

  return result.rows[0] ?? null;
}

function getWorkbookSha256DuplicateIssue(sourceFilename: string): SkinTestIssue {
  return {
    code: "duplicate_workbook_sha256",
    message: `Este XLSX tiene contenido idéntico (sha256) a ${sourceFilename}; se omite como duplicado.`,
    severity: "info",
  };
}

async function findDuplicateSkinTest(
  importId: string,
  parsed: ParsedSkinTestWorkbook,
  resultHash: string
): Promise<DuplicateCheckResult> {
  const { patientName, patientRut, testDate } = parsed.header;
  const patientKey = buildDuplicatePatientKey(patientRut, patientName);
  if (!patientKey || !testDate || parsed.results.length === 0) return { kind: "none" };

  const candidates = await sql<DuplicateCandidateRow>`
    WITH duplicate_candidates AS (
      SELECT
        source_import_id AS "sourceImportId",
        test_date AS "testDate",
        patient_rut AS "patientRut",
        patient_name AS "patientName",
        0 AS "sourceRank",
        created_at AS "createdAt"
      FROM clinical_skin_tests
      WHERE result_hash = ${resultHash}
        AND source_import_id <> ${importId}

      UNION ALL

      SELECT
        coalesce(duplicate_of_import_id, id) AS "sourceImportId",
        (parsed_payload->'header'->>'testDate')::date AS "testDate",
        nullif(parsed_payload->'header'->>'patientRut', '') AS "patientRut",
        nullif(parsed_payload->'header'->>'patientName', '') AS "patientName",
        CASE status
          WHEN 'IMPORTED' THEN 1
          WHEN 'PENDING_REVIEW' THEN 2
          WHEN 'SKIPPED' THEN 3
          ELSE 4
        END AS "sourceRank",
        created_at AS "createdAt"
      FROM clinical_skin_test_imports
      WHERE result_hash = ${resultHash}
        AND id <> ${importId}
        AND parsed_payload IS NOT NULL
        AND parsed_payload->'header'->>'testDate' IS NOT NULL
        AND status IN ('IMPORTED', 'PENDING_REVIEW', 'SKIPPED')
    )
    SELECT DISTINCT ON ("sourceImportId")
      "sourceImportId",
      "testDate",
      "patientRut",
      "patientName",
      "sourceRank"
    FROM duplicate_candidates
    WHERE "sourceImportId" <> ${importId}
    ORDER BY "sourceImportId", "sourceRank" ASC, "createdAt" ASC
  `.execute(kysely);

  const samePatientCandidates = candidates.rows
    .filter((candidate) =>
      isSameDuplicatePatient(patientKey, candidate.patientRut, candidate.patientName)
    )
    .sort(
      (a, b) =>
        a.sourceRank - b.sourceRank ||
        Math.abs(Date.parse(toDateString(a.testDate)) - Date.parse(testDate)) -
          Math.abs(Date.parse(toDateString(b.testDate)) - Date.parse(testDate))
    );

  const exactMatch = samePatientCandidates.find(
    (candidate) => toDateString(candidate.testDate) === testDate
  );
  if (exactMatch) {
    return {
      issue: {
        code: "duplicate_exact_skin_test",
        message:
          "Este archivo tiene el mismo paciente, fecha y resultados que un test cutáneo ya procesado; se omite como duplicado exacto.",
        severity: "info",
      },
      kind: "exact",
      sourceImportId: exactMatch.sourceImportId,
    };
  }

  const probableMatch = samePatientCandidates.find(
    (candidate) => toDateString(candidate.testDate) !== testDate
  );
  if (probableMatch) {
    return {
      issue: {
        code: "probable_duplicate_different_date",
        message: `Mismo paciente y mismos resultados que otro test procesado, pero con fecha distinta (${toDateString(probableMatch.testDate)}). Requiere revisión antes de importar.`,
        severity: "error",
      },
      kind: "probable",
      sourceImportId: probableMatch.sourceImportId,
    };
  }

  return { kind: "none" };
}

function buildDuplicatePatientKey(patientRut: null | string, patientName: null | string) {
  if (patientRut) return `rut:${patientRut}`;
  const normalizedName = normalizeDocumentName(patientName ?? "");
  return normalizedName ? `name:${normalizedName}` : null;
}

function isSameDuplicatePatient(
  expectedKey: string,
  patientRut: null | string,
  patientName: null | string
) {
  return buildDuplicatePatientKey(patientRut, patientName) === expectedKey;
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

const PLACEHOLDER_PATIENT_NAMES = new Set(["nombre", "nombre apellido", "paciente", "apellido nombre"]);

function isPlaceholderPatientName(name: null | string): boolean {
  if (!name) return true;
  const trimmed = name.trim().toLowerCase();
  if (PLACEHOLDER_PATIENT_NAMES.has(trimmed)) return true;
  // Label cells captured as name (e.g. "DIRECCIÓN:", "TELÉFONO:", "CORREO:")
  if (/^[a-záéíóúñü\s]+:$/.test(trimmed)) return true;
  return false;
}

function getTemplateSkinTestIssue(parsed: ParsedSkinTestWorkbook): null | SkinTestIssue {
  const hasRealPatient =
    !isPlaceholderPatientName(parsed.header.patientName) ||
    parsed.header.patientRut ||
    parsed.header.testDate;
  if (hasRealPatient) return null;
  return {
    code: "template_without_patient",
    message: "Plantilla sin paciente/RUT/fecha; se omite de la cola de importación.",
    severity: "info",
  };
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
    duplicateOfImportId: row.duplicateOfImportId ?? null,
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
    workbookSnapshot: {
      archivedAt: row.workbookSnapshotArchivedAt?.toISOString() ?? null,
      cellCount: row.workbookSnapshotCellCount ?? null,
      error: row.workbookSnapshotError,
      extractorVersion: row.workbookSnapshotExtractorVersion ?? null,
      mergeCount: row.workbookSnapshotMergeCount ?? null,
      sheetName: row.workbookSnapshotSheetName ?? null,
      sha256: row.workbookSnapshotSha256 ?? null,
      status: row.workbookSnapshotStatus,
      textHash: row.workbookSnapshotTextHash ?? null,
      updatedAt: row.workbookSnapshotUpdatedAt?.toISOString() ?? null,
    },
  };
}

async function markOneDriveItemDeleted(
  accountId: string,
  driveId: string,
  itemId: string
) {
  const deletedIssue: SkinTestIssue = {
    code: "onedrive_deleted",
    message: "El archivo fue eliminado de OneDrive según el delta de Graph.",
    severity: "info",
  };
  await sql`
    UPDATE clinical_skin_test_imports
    SET
      status = 'SKIPPED',
      issues = (
        COALESCE(issues, '[]'::jsonb) ||
        ${JSON.stringify([deletedIssue])}::jsonb
      ),
      updated_at = now()
    WHERE
      onedrive_account_id = ${accountId}
      AND onedrive_drive_id = ${driveId}
      AND onedrive_item_id = ${itemId}
      AND status NOT IN ('IMPORTED', 'REJECTED')
  `.execute(kysely);
}

function toDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
