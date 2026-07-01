import { createId } from "@paralleldrive/cuid2";
import { db, kysely } from "@finanzas/db";
import type { SchemaType } from "@finanzas/db/schema";
import { sql, type Transaction } from "kysely";
import { logAuditEvent } from "../lib/audit-log.ts";
import { type AuditRowChangeInput, flushRowChangeAudits } from "../lib/audit-diff.ts";
import { DomainError } from "../lib/errors.ts";
import { downloadOneDriveItem } from "../lib/microsoft/onedrive.ts";
import { logEvent, logWarn } from "../lib/logger.ts";
import { matchPatientForRecord } from "../modules/clinical-records/match.ts";
import { createPersonWithoutRut } from "./people-factory.ts";
import { splitChileanName } from "./doctoralia-identity-sync.ts";

type Trx = Transaction<SchemaType>;
import {
  CLINICAL_RECORD_PARSER_VERSION,
  parseClinicalRecordRows,
  parseClinicalRecordWorkbook,
  type ParsedClinicalRecord,
} from "../modules/clinical-records/parser.ts";
import {
  findXlsxFileByOneDriveItem,
  isSnapshotFresh,
  persistXlsxFileSnapshot,
  readXlsxFileSnapshot,
  snapshotToRows,
} from "./xlsx-snapshot.ts";

// Reprocess pipeline for clinical_record_imports. Mirror of
// services/clinical-skin-test-imports.reprocessSkinTestImport but for
// the ficha clínica table set:
//
//   1. download xlsx from OneDrive (or fail with ERROR status)
//   2. parse via modules/clinical-records/parser
//   3. match to patient via modules/clinical-records/match
//   4. on auto-match: materialize ClinicalSeries (kind=MEDICAL_CONSULTATION)
//      + ClinicalRecord; status → IMPORTED
//   5. otherwise: persist parsed_payload + match_candidates; status →
//      PENDING_REVIEW for operator decision
//
// Idempotent — re-running on an IMPORTED row updates the materialised
// row in place via UPSERT on clinical_records.source_import_id (unique).

type ImportRow = {
  id: string;
  filename: string;
  oneDriveAccountId: string | null;
  oneDriveItemId: string;
  oneDriveDriveId: string | null;
};

async function loadImport(id: string): Promise<ImportRow | null> {
  const r = await sql<ImportRow>`
    SELECT id, filename,
           onedrive_account_id AS "oneDriveAccountId",
           onedrive_item_id    AS "oneDriveItemId",
           onedrive_drive_id   AS "oneDriveDriveId"
    FROM clinical_record_imports WHERE id = ${id}
  `.execute(kysely);
  return r.rows[0] ?? null;
}

function computeResultHash(p: ParsedClinicalRecord): string {
  const payload = JSON.stringify({
    n: p.patientName ?? "",
    d: p.consultDate ?? "",
    h: p.history ?? "",
    e: p.physicalExam ?? "",
    x: p.diagnosis ?? "",
    i: p.indications,
    w: p.weightKg,
    t: p.heightCm,
    c: p.headCircumferenceCm,
  });
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) - h + payload.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

async function ensureClinicalSeries(
  trx: Trx,
  patientId: number,
  patientName: string | null
): Promise<number> {
  // One MEDICAL_CONSULTATION series per patient holds every ficha
  // clínica row — the timeline orders by consult_date. Runs inside the
  // caller's transaction so the find-or-create cannot race two parallel
  // workers into creating two sibling series for the same patient.
  const existing = await sql<{ id: number }>`
    SELECT id FROM clinical_series
    WHERE patient_id = ${patientId} AND kind = 'MEDICAL_CONSULTATION'
    ORDER BY id ASC LIMIT 1
  `.execute(trx);
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await sql<{ id: number }>`
    INSERT INTO clinical_series (kind, status, display_name, patient_id, patient_name, created_at, updated_at)
    VALUES ('MEDICAL_CONSULTATION', 'ACTIVE', ${patientName ? `${patientName} · Fichas clínicas` : "Fichas clínicas"}, ${patientId}, ${patientName}, now(), now())
    RETURNING id
  `.execute(trx);
  return created.rows[0].id;
}

async function materializeRecord(
  trx: Trx,
  importId: string,
  parsed: ParsedClinicalRecord,
  clinicalSeriesId: number,
  resultHash: string,
  pendingAudits: AuditRowChangeInput[]
): Promise<void> {
  // UPSERT on source_import_id keeps the row stable across reprocess.
  // RETURNING old/new (PG18) audita qué campos clínicos cambian al reprocesar.
  const upserted = await sql<{
    old_result_hash: string | null;
    new_result_hash: string;
    old_patient_name: string | null;
    new_patient_name: string | null;
    old_diagnosis: string | null;
    new_diagnosis: string | null;
    old_consult_date: string | null;
    new_consult_date: string | null;
  }>`
    INSERT INTO clinical_records (
      id, clinical_series_id, source_import_id,
      consult_date, patient_name, age_label,
      history, physical_exam, diagnosis,
      indications,
      antecedents, medications, known_allergies, observations,
      weight_kg, height_cm, head_circumference_cm,
      anthropometric, raw_header, raw_sections, result_hash,
      created_at, updated_at
    )
    VALUES (
      ${`crr_${importId}`}, ${clinicalSeriesId}, ${importId},
      ${parsed.consultDate}::date,
      ${parsed.patientName}, ${parsed.ageLabel},
      ${parsed.history}, ${parsed.physicalExam}, ${parsed.diagnosis},
      ${JSON.stringify(parsed.indications)}::jsonb,
      ${JSON.stringify(parsed.antecedents)}::jsonb,
      ${JSON.stringify(parsed.medications)}::jsonb,
      ${JSON.stringify(parsed.knownAllergies)}::jsonb,
      ${parsed.observations},
      ${parsed.weightKg}, ${parsed.heightCm}, ${parsed.headCircumferenceCm},
      ${JSON.stringify(parsed.anthropometric)}::jsonb,
      ${JSON.stringify(parsed.rawHeader)}::jsonb,
      ${JSON.stringify(parsed.rawSections)}::jsonb,
      ${resultHash},
      now(), now()
    )
    ON CONFLICT (source_import_id) DO UPDATE SET
      clinical_series_id = EXCLUDED.clinical_series_id,
      consult_date = EXCLUDED.consult_date,
      patient_name = EXCLUDED.patient_name,
      age_label = EXCLUDED.age_label,
      history = EXCLUDED.history,
      physical_exam = EXCLUDED.physical_exam,
      diagnosis = EXCLUDED.diagnosis,
      indications = EXCLUDED.indications,
      antecedents = EXCLUDED.antecedents,
      medications = EXCLUDED.medications,
      known_allergies = EXCLUDED.known_allergies,
      observations = EXCLUDED.observations,
      weight_kg = EXCLUDED.weight_kg,
      height_cm = EXCLUDED.height_cm,
      head_circumference_cm = EXCLUDED.head_circumference_cm,
      anthropometric = EXCLUDED.anthropometric,
      raw_header = EXCLUDED.raw_header,
      raw_sections = EXCLUDED.raw_sections,
      result_hash = EXCLUDED.result_hash,
      updated_at = now()
    RETURNING
      old.result_hash AS old_result_hash, new.result_hash AS new_result_hash,
      old.patient_name AS old_patient_name, new.patient_name AS new_patient_name,
      old.diagnosis AS old_diagnosis, new.diagnosis AS new_diagnosis,
      old.consult_date AS old_consult_date, new.consult_date AS new_consult_date
  `.execute(trx);

  // Solo audita updates con cambio real de contenido (old != null y hash distinto).
  // Se acumula y se vacía DESPUÉS del commit (auditar hechos persistidos).
  const row = upserted.rows[0];
  if (row && row.old_result_hash != null && row.old_result_hash !== row.new_result_hash) {
    pendingAudits.push({
      kind: "IMPORT_UPSERT",
      resource: "clinical_record",
      resourceId: `crr_${importId}`,
      oldRow: {
        result_hash: row.old_result_hash,
        patient_name: row.old_patient_name,
        diagnosis: row.old_diagnosis,
        consult_date: row.old_consult_date,
      },
      newRow: {
        result_hash: row.new_result_hash,
        patient_name: row.new_patient_name,
        diagnosis: row.new_diagnosis,
        consult_date: row.new_consult_date,
      },
    });
  }
}

export async function reprocessClinicalRecordImport(id: string): Promise<{
  status: "IMPORTED" | "PENDING_REVIEW" | "ERROR";
  reason?: string;
  candidates?: number;
}> {
  // Download + parse run OUTSIDE the transaction so a slow OneDrive
  // fetch doesn't hold a Postgres connection (default pool size 10).
  // The DB-touching work then runs inside a single transaction with
  // the per-import advisory lock, so concurrent workers on the same
  // id serialise + every UPDATE/UPSERT participates in the lock.
  const row = await loadImport(id);
  if (!row) throw new DomainError("NOT_FOUND", `Import ${id} not found`);

  // Prefer the shared snapshot: if the scanned library has a fresh first-sheet
  // snapshot for this OneDrive item, re-parse from DB and skip the download
  // entirely. Otherwise download once, parse, and archive the snapshot so the
  // next reprocess is free.
  let parsed: ParsedClinicalRecord | null = null;
  const xlsxFile = await findXlsxFileByOneDriveItem(
    row.oneDriveAccountId,
    row.oneDriveDriveId,
    row.oneDriveItemId
  );
  if (xlsxFile) {
    const snap = await readXlsxFileSnapshot(xlsxFile.id);
    if (
      snap &&
      isSnapshotFresh(snap, { etag: xlsxFile.etag, ctag: xlsxFile.ctag }) &&
      snap.snapshot
    ) {
      parsed = parseClinicalRecordRows(snapshotToRows(snap.snapshot));
    }
  }

  if (!parsed) {
    let buffer: Buffer;
    try {
      buffer = await downloadOneDriveItem(
        row.oneDriveAccountId ?? "",
        row.oneDriveItemId,
        row.oneDriveDriveId ?? undefined
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sql`
        UPDATE clinical_record_imports
        SET status = 'ERROR', error = ${msg}, parser_version = ${CLINICAL_RECORD_PARSER_VERSION},
            updated_at = now()
        WHERE id = ${id}
      `.execute(kysely);
      return { status: "ERROR", reason: msg };
    }
    parsed = parseClinicalRecordWorkbook(buffer);
    // Archive for next time (best-effort; only when the library row exists).
    if (xlsxFile) {
      try {
        await persistXlsxFileSnapshot(xlsxFile.id, buffer, {
          etag: xlsxFile.etag,
          ctag: xlsxFile.ctag,
        });
      } catch (err) {
        logWarn("[clinical-record] snapshot archive failed", {
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Acumular audits dentro de la tx; vaciarlos solo si commitea (hechos persistidos).
  const pendingAudits: AuditRowChangeInput[] = [];
  const result = await kysely.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`cri:${id}`}, 0))`.execute(trx);
    return reprocessInLock(trx, id, parsed, pendingAudits);
  });
  await flushRowChangeAudits(pendingAudits);
  return result;
}

async function reprocessInLock(
  trx: Trx,
  id: string,
  parsed: ParsedClinicalRecord,
  pendingAudits: AuditRowChangeInput[]
): Promise<{
  status: "IMPORTED" | "PENDING_REVIEW" | "ERROR";
  reason?: string;
  candidates?: number;
}> {
  const resultHash = computeResultHash(parsed);
  const match = await matchPatientForRecord(parsed);

  if (match.matchedPatientId) {
    const seriesId = await ensureClinicalSeries(trx, match.matchedPatientId, parsed.patientName);
    await materializeRecord(trx, id, parsed, seriesId, resultHash, pendingAudits);
    await sql`
      UPDATE clinical_record_imports SET
        status = 'IMPORTED',
        parser_version = ${CLINICAL_RECORD_PARSER_VERSION},
        confidence = ${parsed.confidence},
        error = NULL,
        issues = ${JSON.stringify(parsed.issues)}::jsonb,
        parsed_payload = ${JSON.stringify({
          consultDate: parsed.consultDate,
          patientName: parsed.patientName,
          ageLabel: parsed.ageLabel,
          history: parsed.history,
          physicalExam: parsed.physicalExam,
          diagnosis: parsed.diagnosis,
          indications: parsed.indications,
          antecedents: parsed.antecedents,
          medications: parsed.medications,
          knownAllergies: parsed.knownAllergies,
          observations: parsed.observations,
          weightKg: parsed.weightKg,
          heightCm: parsed.heightCm,
          headCircumferenceCm: parsed.headCircumferenceCm,
          anthropometric: parsed.anthropometric,
          rawHeader: parsed.rawHeader,
        })}::jsonb,
        result_hash = ${resultHash},
        matched_patient_id = ${match.matchedPatientId},
        matched_clinical_series_id = ${seriesId},
        match_candidates = ${JSON.stringify(match.candidates)}::jsonb,
        imported_at = now(),
        updated_at = now()
      WHERE id = ${id}
    `.execute(trx);
    logEvent("[clinical-record.import] materialized", {
      id,
      patientId: match.matchedPatientId,
      seriesId,
    });
    // HIPAA §164.312(b) audit control: every PHI materialisation lands
    // in the append-only audit_logs (HMAC-chained per migration
    // 20260512010000) so any later modification is detectable.
    await logAuditEvent({
      kind: "OTHER",
      actorLabel: "system:clinical-record-reprocess",
      resource: "clinical_record_imports",
      resourceId: id,
      outcome: "ok",
      message: "import_materialized",
      metadata: {
        patientId: match.matchedPatientId,
        clinicalSeriesId: seriesId,
        candidateCount: match.candidates.length,
      },
    });
    return { status: "IMPORTED", candidates: match.candidates.length };
  }

  await sql`
    UPDATE clinical_record_imports SET
      status = 'PENDING_REVIEW',
      parser_version = ${CLINICAL_RECORD_PARSER_VERSION},
      confidence = ${parsed.confidence},
      error = NULL,
      issues = ${JSON.stringify(parsed.issues)}::jsonb,
      parsed_payload = ${JSON.stringify({
        consultDate: parsed.consultDate,
        patientName: parsed.patientName,
        ageLabel: parsed.ageLabel,
        history: parsed.history,
        physicalExam: parsed.physicalExam,
        diagnosis: parsed.diagnosis,
        indications: parsed.indications,
        weightKg: parsed.weightKg,
        heightCm: parsed.heightCm,
        headCircumferenceCm: parsed.headCircumferenceCm,
        anthropometric: parsed.anthropometric,
        rawHeader: parsed.rawHeader,
      })}::jsonb,
      result_hash = ${resultHash},
      matched_patient_id = NULL,
      matched_clinical_series_id = NULL,
      match_candidates = ${JSON.stringify(match.candidates)}::jsonb,
      updated_at = now()
    WHERE id = ${id}
  `.execute(trx);
  return { status: "PENDING_REVIEW", candidates: match.candidates.length };
}

// Create a brand-new Patient from a ficha whose person exists nowhere (no RUT,
// no candidate) and approve the import into it. Operator-driven only — the
// identity resolver refuses name-only creation (Ruminot-dup risk), so this is a
// deliberate per-import action the reviewer takes when no candidate matches.
// Identity is name + (relative) ageLabel; birthDate stays null (ageLabel is not
// an absolute date). Reuses approveClinicalRecordImport for the materialize.
export async function createPatientFromImport(
  id: string,
  reviewedBy: number,
  notes?: string
): Promise<{ patientId: number }> {
  const r = await sql<{ parsedPayload: ParsedClinicalRecord | null }>`
    SELECT parsed_payload AS "parsedPayload" FROM clinical_record_imports WHERE id = ${id}
  `.execute(kysely);
  const parsed = r.rows[0]?.parsedPayload;
  const patientName = parsed?.patientName?.trim();
  if (!patientName) {
    throw new DomainError("UNPROCESSABLE_ENTITY", "Import has no parsed patient name");
  }
  const { names, fatherName, motherName } = splitChileanName(patientName);
  const personId = await createPersonWithoutRut({ rut: null, names, fatherName, motherName });
  const patient = await db.patient.create({ data: { personId }, select: { id: true } });
  await approveClinicalRecordImport(id, patient.id, reviewedBy, notes ?? "paciente creado desde ficha");
  logEvent("[clinical-record] patient created from import", { id, patientId: patient.id, personId });
  return { patientId: patient.id };
}

export async function approveClinicalRecordImport(
  id: string,
  patientId: number,
  reviewedBy: number,
  notes?: string
): Promise<void> {
  const row = await loadImport(id);
  if (!row) throw new DomainError("NOT_FOUND", `Import ${id} not found`);
  // Re-fetch parsed payload from DB to avoid downloading again.
  const r = await sql<{ parsedPayload: ParsedClinicalRecord | null; resultHash: string | null }>`
    SELECT parsed_payload AS "parsedPayload", result_hash AS "resultHash"
    FROM clinical_record_imports WHERE id = ${id}
  `.execute(kysely);
  const parsed = r.rows[0]?.parsedPayload;
  if (!parsed) {
    throw new DomainError("UNPROCESSABLE_ENTITY", "Import has no parsed payload — reprocess first");
  }
  const pendingAudits: AuditRowChangeInput[] = [];
  const seriesId = await kysely.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`cri:${id}`}, 0))`.execute(trx);
    const sid = await ensureClinicalSeries(trx, patientId, parsed.patientName ?? null);
    await materializeRecord(
      trx,
      id,
      {
        ...parsed,
        indications: parsed.indications ?? [],
        antecedents: parsed.antecedents ?? { personal: [], family: [] },
        medications: parsed.medications ?? [],
        knownAllergies: parsed.knownAllergies ?? [],
        observations: parsed.observations ?? null,
        anthropometric: parsed.anthropometric ?? {},
        rawHeader: parsed.rawHeader ?? {},
        rawSections: parsed.rawSections ?? {},
        issues: parsed.issues ?? [],
        confidence: parsed.confidence ?? 0,
      } as ParsedClinicalRecord,
      sid,
      r.rows[0]?.resultHash ?? "",
      pendingAudits
    );
    await sql`
      UPDATE clinical_record_imports SET
        status = 'IMPORTED',
        matched_patient_id = ${patientId},
        matched_clinical_series_id = ${sid},
        reviewed_by = ${reviewedBy},
        reviewed_at = now(),
        review_notes = ${notes ?? null},
        imported_at = now(),
        updated_at = now()
      WHERE id = ${id}
    `.execute(trx);
    return sid;
  });
  await flushRowChangeAudits(pendingAudits);
  await logAuditEvent({
    kind: "OTHER",
    userId: reviewedBy,
    resource: "clinical_record_imports",
    resourceId: id,
    outcome: "ok",
    message: "import_approved",
    metadata: { patientId, clinicalSeriesId: seriesId, notes: notes ?? null },
  });
}

export async function rejectClinicalRecordImport(
  id: string,
  reviewedBy: number,
  notes?: string
): Promise<void> {
  await sql`
    UPDATE clinical_record_imports SET
      status = 'REJECTED',
      reviewed_by = ${reviewedBy},
      reviewed_at = now(),
      review_notes = ${notes ?? null},
      updated_at = now()
    WHERE id = ${id}
  `.execute(kysely);
  await logAuditEvent({
    kind: "OTHER",
    userId: reviewedBy,
    resource: "clinical_record_imports",
    resourceId: id,
    outcome: "denied",
    message: "import_rejected",
    metadata: { notes: notes ?? null },
  });
}

// OneDrive item metadata needed to enqueue a ficha. Mirrors the subset of
// buildOneDriveItemMetadata the scan already produces — passed in so the ficha
// module owns the clinical_record_imports insert without depending on the
// skin-test scan internals.
export type OneDriveRecordMetadata = {
  id: string;
  driveId: string | null;
  sourceKey?: string | null;
  sourceDriveId?: string | null;
  sourceItemId?: string | null;
  sharePointUniqueId?: string | null;
  quickXorHash?: string | null;
  sha1Hash?: string | null;
  crc32Hash?: string | null;
  eTag?: string | null;
  cTag?: string | null;
  webUrl?: string | null;
  path?: string | null;
  filename: string;
  mimeType?: string | null;
  size?: number | null;
  modifiedAt?: string | null;
};

// Enqueue (or refresh) a OneDrive-discovered ficha into clinical_record_imports
// as PENDING_REVIEW + unparsed — the same state the corpus backfill produced,
// so the existing reprocess/auto-approve pipeline picks it up. Owned by the
// ficha module; the generic OneDrive scan calls this for CLINICAL_RECORD docs.
// Idempotent: re-discovery of an already-processed row only refreshes the
// OneDrive metadata, never resets its status/parse.
export async function enqueueClinicalRecordImportFromOneDrive(
  accountId: string,
  metadata: OneDriveRecordMetadata
): Promise<{ id: string; created: boolean }> {
  const existing = await sql<{ id: string }>`
    SELECT id FROM clinical_record_imports
    WHERE onedrive_account_id = ${accountId}
      AND onedrive_drive_id = ${metadata.driveId}
      AND onedrive_item_id = ${metadata.id}
  `.execute(kysely);
  const importId = existing.rows[0]?.id ?? createId();

  await sql`
    INSERT INTO clinical_record_imports (
      id, onedrive_account_id, onedrive_item_id, onedrive_drive_id,
      onedrive_source_key, onedrive_source_drive_id, onedrive_source_item_id,
      onedrive_sharepoint_unique_id, onedrive_quick_xor_hash, onedrive_sha1_hash,
      onedrive_crc32_hash, onedrive_etag, onedrive_ctag, onedrive_web_url,
      path, filename, mime_type, size, modified_at,
      parser_version, status, confidence, created_at, updated_at
    ) VALUES (
      ${importId}, ${accountId}, ${metadata.id}, ${metadata.driveId},
      ${metadata.sourceKey ?? null}, ${metadata.sourceDriveId ?? null}, ${metadata.sourceItemId ?? null},
      ${metadata.sharePointUniqueId ?? null}, ${metadata.quickXorHash ?? null}, ${metadata.sha1Hash ?? null},
      ${metadata.crc32Hash ?? null}, ${metadata.eTag ?? null}, ${metadata.cTag ?? null}, ${metadata.webUrl ?? null},
      ${metadata.path ?? null}, ${metadata.filename}, ${metadata.mimeType ?? null}, ${metadata.size ?? null},
      ${metadata.modifiedAt ?? null}::timestamptz,
      '', 'PENDING_REVIEW', 0, now(), now()
    )
    ON CONFLICT (onedrive_account_id, onedrive_drive_id, onedrive_item_id)
    DO UPDATE SET
      onedrive_etag = EXCLUDED.onedrive_etag,
      onedrive_ctag = EXCLUDED.onedrive_ctag,
      onedrive_web_url = EXCLUDED.onedrive_web_url,
      path = COALESCE(EXCLUDED.path, clinical_record_imports.path),
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      modified_at = EXCLUDED.modified_at,
      updated_at = now()
  `.execute(kysely);

  return { id: importId, created: existing.rows.length === 0 };
}

// Multi-select approve: one transaction per import (reusing the single-row
// path), collecting per-item failures so one bad row doesn't abort the batch.
export async function approveClinicalRecordImports(
  items: Array<{ id: string; patientId: number }>,
  reviewedBy: number,
  notes?: string
): Promise<{ approved: number; errors: Array<{ id: string; message: string }> }> {
  let approved = 0;
  const errors: Array<{ id: string; message: string }> = [];
  for (const it of items) {
    try {
      await approveClinicalRecordImport(it.id, it.patientId, reviewedBy, notes);
      approved += 1;
    } catch (error) {
      errors.push({ id: it.id, message: error instanceof Error ? error.message : "error" });
    }
  }
  return { approved, errors };
}

export async function rejectClinicalRecordImports(
  ids: string[],
  reviewedBy: number,
  notes?: string
): Promise<{ rejected: number }> {
  if (ids.length === 0) return { rejected: 0 };
  const r = await sql<{ id: string }>`
    UPDATE clinical_record_imports SET
      status = 'REJECTED',
      reviewed_by = ${reviewedBy},
      reviewed_at = now(),
      review_notes = ${notes ?? null},
      updated_at = now()
    WHERE id = ANY(${ids})
    RETURNING id
  `.execute(kysely);
  for (const row of r.rows) {
    await logAuditEvent({
      kind: "OTHER",
      userId: reviewedBy,
      resource: "clinical_record_imports",
      resourceId: row.id,
      outcome: "denied",
      message: "import_rejected",
      metadata: { notes: notes ?? null, bulk: true },
    });
  }
  return { rejected: r.rows.length };
}

export async function reprocessPendingClinicalRecordImports(limit = 200): Promise<{
  processed: number;
  imported: number;
  pending: number;
  errors: number;
}> {
  const r = await sql<{ id: string }>`
    SELECT id FROM clinical_record_imports
    WHERE status IN ('PENDING_REVIEW', 'ERROR')
      AND parser_version <> ${CLINICAL_RECORD_PARSER_VERSION}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `.execute(kysely);
  let imported = 0;
  let pending = 0;
  let errors = 0;
  for (const row of r.rows) {
    try {
      const out = await reprocessClinicalRecordImport(row.id);
      if (out.status === "IMPORTED") imported += 1;
      else if (out.status === "PENDING_REVIEW") pending += 1;
      else errors += 1;
    } catch (err) {
      errors += 1;
      logWarn("[clinical-record.bulk] error", {
        id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { processed: r.rows.length, imported, pending, errors };
}
