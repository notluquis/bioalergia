import { kysely } from "@finanzas/db";
import { createId } from "@paralleldrive/cuid2";
import { sql } from "kysely";
import {
  downloadOneDriveItem,
  getOneDriveStatus,
  listOneDriveDeltaItems,
  type OneDriveItem,
} from "../lib/microsoft/onedrive";
import {
  parseSkinTestWorkbookBuffer,
  SKIN_TEST_PARSER_VERSION,
  type ParsedSkinTestResult,
  type ParsedSkinTestWorkbook,
  type SkinTestIssue,
} from "./clinical-skin-test-parser";

const AUTO_IMPORT_MIN_CONFIDENCE = 80;
const JOB_TYPE = "clinical-skin-test-import-sync";

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

export type SkinTestImportStatus = "ERROR" | "IMPORTED" | "PENDING_REVIEW" | "REJECTED" | "SKIPPED";

export interface SkinTestImportOutput {
  confidence: number;
  error: null | string;
  filename: string;
  id: string;
  importedAt: null | string;
  issues: SkinTestIssue[];
  modifiedAt: null | string;
  oneDriveWebUrl: null | string;
  parsedPayload: null | ParsedPayload;
  path: null | string;
  reviewedAt: null | string;
  reviewNotes: null | string;
  skinTestId?: null | string;
  matchedSeriesId?: null | number;
  status: SkinTestImportStatus;
  updatedAt: string;
}

export interface ParsedPayload {
  header: ParsedSkinTestWorkbook["header"];
  results: ParsedSkinTestResult[];
}

export interface SkinTestDetailOutput {
  ageLabel: null | string;
  clinicalSeriesId: number;
  id: string;
  panelTitle: null | string;
  patientEmail: null | string;
  patientName: null | string;
  patientPhone: null | string;
  patientRut: null | string;
  results: ParsedSkinTestResult[];
  sourceImportId: string;
  testDate: string;
}

interface ImportRow {
  confidence: number;
  error: null | string;
  filename: string;
  id: string;
  importedAt: Date | null;
  issues: unknown;
  modifiedAt: Date | null;
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

export function getSkinTestImportJobType() {
  return JOB_TYPE;
}

export async function syncClinicalSkinTestImports(options?: {
  folderPath?: string;
  force?: boolean;
  onProgress?: (processed: number, total: number, message: string) => void;
}) {
  const status = await getOneDriveStatus();
  if (!status.connected) {
    throw new Error("OneDrive no conectado.");
  }

  let imported = 0;
  let pending = 0;
  let skipped = 0;
  let errors = 0;
  let scanned = 0;
  let xlsx = 0;

  for (const account of status.accounts) {
    const { items } = await listOneDriveDeltaItems(account.accountId, {
      force: options?.force,
    });
    const xlsxItems = items.filter(isImportableXlsx);
    scanned += items.length;
    xlsx += xlsxItems.length;

    for (const [index, item] of xlsxItems.entries()) {
      options?.onProgress?.(
        index + 1, 
        Math.max(xlsxItems.length, 1), 
        `[${account.email}] Procesando ${item.name}`
      );
      const result = await processOneDriveSkinTestItem(account.accountId, item, { force: options?.force });
      if (result.status === "IMPORTED") imported += 1;
      else if (result.status === "PENDING_REVIEW") pending += 1;
      else if (result.status === "ERROR") errors += 1;
      else skipped += 1;
    }
  }

  return { errors, imported, pending, scanned, skipped, xlsx };
}

export async function processOneDriveSkinTestItem(
  accountId: string,
  item: OneDriveItem,
  options?: { force?: boolean },
): Promise<SkinTestImportOutput> {
  const existing = await getImportByOneDriveItemId(accountId, item.id);
  if (
    existing &&
    !options?.force &&
    existing.status !== "ERROR" &&
    existing.status !== "PENDING_REVIEW" &&
    existing.oneDriveETag === item.eTag &&
    existing.oneDriveCTag === item.cTag
  ) {
    return toImportOutput(existing);
  }

  const importId = existing?.id ?? createId();
  const metadata = {
    cTag: item.cTag ?? null,
    driveId: item.parentReference?.driveId ?? null,
    eTag: item.eTag ?? null,
    filename: item.name,
    id: item.id,
    mimeType: item.file?.mimeType ?? null,
    modifiedAt: item.lastModifiedDateTime ?? null,
    path: item.parentReference?.path ?? null,
    size: item.size ?? null,
    webUrl: item.webUrl ?? null,
  };

  try {
    const buffer = await downloadOneDriveItem(accountId, item.id);
    const parsed = await parseSkinTestWorkbookBuffer(
      buffer as unknown as Parameters<typeof parseSkinTestWorkbookBuffer>[0],
    );
    const materialization = await maybeMaterializeImport(importId, parsed);
    const allIssues = [...parsed.issues, ...materialization.issues];
    const status = materialization.seriesId && canAutoImport(parsed, allIssues)
      ? "IMPORTED"
      : "PENDING_REVIEW";

    await upsertImport({
      accountId,
      confidence: computeConfidence(parsed.confidence, allIssues),
      error: null,
      id: importId,
      issues: allIssues,
      metadata,
      parsedPayload: { header: parsed.header, results: parsed.results },
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
      issues: [{ code: "parser_error", message: error instanceof Error ? error.message : String(error), severity: "error" }],
      metadata,
      parsedPayload: null,
      status: "ERROR",
    });
    return await getSkinTestImport(importId);
  }
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
  await writeSkinTest(id, match.seriesId, { header: parsed.header, results: parsed.results });
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
  const result = await sql<{ oneDriveItemId: string; oneDriveAccountId: string | null }>`
    SELECT onedrive_item_id AS "oneDriveItemId", onedrive_account_id AS "oneDriveAccountId"
    FROM clinical_skin_test_imports
    WHERE id = ${id}
  `.execute(kysely);
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

  const buffer = await downloadOneDriveItem(accountId, itemId);
  const parsed = await parseSkinTestWorkbookBuffer(
    buffer as unknown as Parameters<typeof parseSkinTestWorkbookBuffer>[0],
  );
  const materialization = await maybeMaterializeImport(id, parsed);
  const allIssues = [...parsed.issues, ...materialization.issues];
  await sql`
    UPDATE clinical_skin_test_imports
    SET parser_version = ${SKIN_TEST_PARSER_VERSION},
        status = ${materialization.seriesId && canAutoImport(parsed, allIssues) ? "IMPORTED" : "PENDING_REVIEW"}::"ClinicalSkinTestImportStatus",
        confidence = ${computeConfidence(parsed.confidence, allIssues)},
        error = null,
        issues = ${JSON.stringify(allIssues)}::jsonb,
        parsed_payload = ${JSON.stringify({ header: parsed.header, results: parsed.results })}::jsonb,
        updated_at = now()
    WHERE id = ${id}
  `.execute(kysely);
  if (materialization.seriesId && canAutoImport(parsed, allIssues)) {
    await writeSkinTest(id, materialization.seriesId, parsed);
    await markImported(id);
  }
  return await getSkinTestImport(id);
}

export async function listSkinTestsBySeries(clinicalSeriesId: number) {
  const testsResult = await sql<{
    ageLabel: null | string;
    clinicalSeriesId: number;
    id: string;
    panelTitle: null | string;
    patientEmail: null | string;
    patientName: null | string;
    patientPhone: null | string;
    patientRut: null | string;
    sourceImportId: string;
    testDate: Date | string;
  }>`
    SELECT
      id,
      clinical_series_id AS "clinicalSeriesId",
      source_import_id AS "sourceImportId",
      test_date AS "testDate",
      patient_name AS "patientName",
      patient_rut AS "patientRut",
      patient_email AS "patientEmail",
      patient_phone AS "patientPhone",
      age_label AS "ageLabel",
      panel_title AS "panelTitle"
    FROM clinical_skin_tests
    WHERE clinical_series_id = ${clinicalSeriesId}
    ORDER BY test_date DESC, created_at DESC
  `.execute(kysely);

  const tests: SkinTestDetailOutput[] = [];
  for (const test of testsResult.rows) {
    const results = await getResultsForTest(test.id);
    tests.push({
      ...test,
      results,
      testDate: toDateString(test.testDate),
    });
  }
  return { tests };
}

async function maybeMaterializeImport(
  importId: string,
  parsed: ParsedSkinTestWorkbook,
): Promise<MatchResult> {
  void importId;
  const match = await matchOrCreateClinicalSeries(
    { header: parsed.header, results: parsed.results },
    { allowCreate: canAutoImport(parsed, parsed.issues) },
  );
  return match;
}

async function matchOrCreateClinicalSeries(
  payload: ParsedPayload,
  options: { allowCreate: boolean },
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

async function writeSkinTest(
  importId: string,
  seriesId: number,
  parsed: Pick<ParsedSkinTestWorkbook, "header" | "results">,
) {
  const { header } = parsed;
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
      ${JSON.stringify(header)}::jsonb,
      now(),
      now()
    )
  `.execute(kysely);

  for (const result of parsed.results) {
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
      VALUES (
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
        ${result.controlType}::"ClinicalSkinTestControlType",
        ${result.sortOrder},
        ${JSON.stringify(result.rawCells)}::jsonb
      )
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

async function getImportByOneDriveItemId(accountId: string, itemId: string) {
  const result = await sql<(ImportRow & { oneDriveCTag: null | string; oneDriveETag: null | string })>`
    SELECT
      i.*,
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
    WHERE i.onedrive_account_id = ${accountId}
      AND i.onedrive_item_id = ${itemId}
  `.execute(kysely);
  return result.rows[0] ?? null;
}

async function upsertImport(params: {
  accountId: string;
  confidence: number;
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
      now(),
      now()
    )
    ON CONFLICT (onedrive_account_id, onedrive_item_id)
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

function isImportableXlsx(item: OneDriveItem): boolean {
  if (item.deleted) return false;
  if (!item.file) return false;
  if (!/\.xlsx$/i.test(item.name)) return false;
  if (/^~\$/.test(item.name)) return false;
  return true;
}

function canAutoImport(parsed: ParsedSkinTestWorkbook, issues: SkinTestIssue[]): boolean {
  return (
    parsed.confidence >= AUTO_IMPORT_MIN_CONFIDENCE &&
    parsed.results.length > 0 &&
    issues.every((issue) => issue.severity !== "error")
  );
}

function computeConfidence(baseConfidence: number, issues: SkinTestIssue[]): number {
  const penalty = issues.reduce((acc, issue) => acc + (issue.severity === "error" ? 35 : issue.severity === "warning" ? 10 : 0), 0);
  return Math.max(0, Math.min(100, baseConfidence - penalty));
}

function toImportOutput(row: ImportRow): SkinTestImportOutput {
  return {
    confidence: row.confidence,
    error: row.error,
    filename: row.filename,
    id: row.id,
    importedAt: row.importedAt?.toISOString() ?? null,
    issues: Array.isArray(row.issues) ? row.issues as SkinTestIssue[] : [],
    modifiedAt: row.modifiedAt?.toISOString() ?? null,
    oneDriveWebUrl: row.oneDriveWebUrl,
    parsedPayload: row.parsedPayload && typeof row.parsedPayload === "object" ? row.parsedPayload as ParsedPayload : null,
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
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
