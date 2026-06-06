import { kysely } from "@finanzas/db";
import type { clinicalRecordAnalyticsSchema } from "@finanzas/orpc-contracts/clinical-records";
import { sql } from "kysely";
import type { z } from "zod";

// Analytics for the fichas clínicas corpus. Queue-state metrics come from
// clinical_record_imports (status mix, match rate); content metrics (by month,
// top diagnoses, top patients) come from the materialized clinical_records,
// optionally bounded by consult_date.

type Analytics = z.infer<typeof clinicalRecordAnalyticsSchema>;

type DateRange = { dateFrom?: string; dateTo?: string };

function consultDateWhere(range: DateRange) {
  const parts = [
    sql`cr.consult_date IS NOT NULL`,
    range.dateFrom ? sql`cr.consult_date >= ${range.dateFrom}::date` : null,
    range.dateTo ? sql`cr.consult_date <= ${range.dateTo}::date` : null,
  ].filter(Boolean) as ReturnType<typeof sql>[];
  return sql.join(parts, sql` AND `);
}

export async function getClinicalRecordAnalytics(range: DateRange): Promise<Analytics> {
  const where = consultDateWhere(range);

  const statusRows = (
    await sql<{ status: string; c: string }>`
      SELECT status::text AS status, COUNT(*)::text AS c
      FROM clinical_record_imports
      GROUP BY status
    `.execute(kysely)
  ).rows;

  const byStatus = statusRows.map((r) => ({
    status: r.status as Analytics["byStatus"][number]["status"],
    count: Number.parseInt(r.c, 10),
  }));
  const countFor = (s: string) => byStatus.find((b) => b.status === s)?.count ?? 0;
  const imported = countFor("IMPORTED");
  const pending = countFor("PENDING_REVIEW");
  const discovered = countFor("DISCOVERED");
  const errors = countFor("ERROR");
  const rejected = countFor("REJECTED");
  const imports = byStatus.reduce((acc, b) => acc + b.count, 0);
  const decided = imported + pending + rejected;
  const matchRate = decided > 0 ? imported / decided : 0;

  const recordsRow = (
    await sql<{ total: string; with_date: string }>`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE consult_date IS NOT NULL)::text AS with_date
      FROM clinical_records
    `.execute(kysely)
  ).rows[0];

  const byMonth = (
    await sql<{ month: string; c: string }>`
      SELECT to_char(cr.consult_date, 'YYYY-MM') AS month, COUNT(*)::text AS c
      FROM clinical_records cr
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1 ASC
    `.execute(kysely)
  ).rows.map((r) => ({ month: r.month, count: Number.parseInt(r.c, 10) }));

  const topDiagnoses = (
    await sql<{ label: string; c: string }>`
      SELECT trim(split_part(cr.diagnosis, E'\n', 1)) AS label, COUNT(*)::text AS c
      FROM clinical_records cr
      WHERE ${where} AND cr.diagnosis IS NOT NULL AND trim(cr.diagnosis) <> ''
      GROUP BY 1
      ORDER BY COUNT(*) DESC, 1 ASC
      LIMIT 15
    `.execute(kysely)
  ).rows
    .filter((r) => r.label)
    .map((r) => ({ label: r.label, count: Number.parseInt(r.c, 10) }));

  const topPatients = (
    await sql<{ name: string; c: string }>`
      SELECT cs.patient_name AS name, COUNT(*)::text AS c
      FROM clinical_records cr
      JOIN clinical_series cs ON cs.id = cr.clinical_series_id
      WHERE ${where} AND cs.kind = 'MEDICAL_CONSULTATION' AND cs.patient_name IS NOT NULL
      GROUP BY cs.patient_name
      ORDER BY COUNT(*) DESC, cs.patient_name ASC
      LIMIT 15
    `.execute(kysely)
  ).rows.map((r) => ({ patientName: r.name, count: Number.parseInt(r.c, 10) }));

  return {
    byStatus,
    totals: { imports, imported, pending, discovered, errors, rejected },
    matchRate,
    records: {
      total: Number.parseInt(recordsRow?.total ?? "0", 10),
      withDate: Number.parseInt(recordsRow?.with_date ?? "0", 10),
    },
    byMonth,
    topDiagnoses,
    topPatients,
  };
}
