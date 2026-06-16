import { db } from "@finanzas/db";
import type { clinicalRecordAnalyticsSchema } from "@finanzas/orpc-contracts/clinical-records";
import { sql } from "kysely";
import type { z } from "zod";

// Analytics for the fichas clínicas corpus. Queue-state metrics come from
// clinical_record_imports (status mix, match rate); content metrics (by month,
// top diagnoses, top patients) come from the materialized clinical_records,
// optionally bounded by consult_date.

type Analytics = z.infer<typeof clinicalRecordAnalyticsSchema>;

type DateRange = { dateFrom?: string; dateTo?: string };

// Base clinical_records query bounded by consult_date. Mirrors the old
// consultDateWhere() sql.join: cr.consult_date IS NOT NULL [AND >= from::date]
// [AND <= to::date]. Column refs in .where() use camelCase ("cr.consultDate");
// the ::date cast bounds stay in raw sql fragments (physical snake_case).
// Reused as-is by byMonth/topDiagnoses and extended with a join for topPatients
// (Kysely query builders are immutable; join order vs where is irrelevant).
function consultDateBaseQuery(range: DateRange) {
  let q = db.$qb.selectFrom("ClinicalRecord as cr").where("cr.consultDate", "is not", null);
  if (range.dateFrom) {
    q = q.where(sql<boolean>`cr.consult_date >= ${range.dateFrom}::date`);
  }
  if (range.dateTo) {
    q = q.where(sql<boolean>`cr.consult_date <= ${range.dateTo}::date`);
  }
  return q;
}

export async function getClinicalRecordAnalytics(range: DateRange): Promise<Analytics> {
  type StatusGroupRow = { status: string; _count: { _all: number } };
  const statusRows = (await db.clinicalRecordImport.groupBy({
    by: ["status"],
    _count: { _all: true },
  })) as StatusGroupRow[];

  const byStatus = statusRows.map((r) => ({
    status: r.status as Analytics["byStatus"][number]["status"],
    count: r._count._all,
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

  const [recordsTotal, recordsWithDate] = await Promise.all([
    db.clinicalRecord.count(),
    db.clinicalRecord.count({ where: { consultDate: { not: null } } }),
  ]);

  const monthExpr = sql<string>`to_char(cr.consult_date, 'YYYY-MM')`;
  const byMonth = (
    await consultDateBaseQuery(range)
      .select([monthExpr.as("month"), sql<number>`count(*)`.as("c")])
      .groupBy(monthExpr)
      .orderBy(monthExpr, "asc")
      .execute()
  ).map((r) => ({ month: String(r.month), count: Number(r.c) }));

  const diagnosisLabelExpr = sql<string>`trim(split_part(cr.diagnosis, E'\n', 1))`;
  const topDiagnoses = (
    await consultDateBaseQuery(range)
      .where(sql<boolean>`cr.diagnosis IS NOT NULL`)
      .where(sql<boolean>`trim(cr.diagnosis) <> ''`)
      .select([diagnosisLabelExpr.as("label"), sql<number>`count(*)`.as("c")])
      .groupBy(diagnosisLabelExpr)
      .orderBy(sql`count(*)`, "desc")
      .orderBy(diagnosisLabelExpr, "asc")
      .limit(15)
      .execute()
  )
    .filter((r) => r.label)
    .map((r) => ({ label: String(r.label), count: Number(r.c) }));

  const topPatients = (
    await consultDateBaseQuery(range)
      .innerJoin("ClinicalSeries as cs", "cs.id", "cr.clinicalSeriesId")
      .where("cs.kind", "=", "MEDICAL_CONSULTATION")
      .where("cs.patientName", "is not", null)
      .select(["cs.patientName as name", sql<number>`count(*)`.as("c")])
      .groupBy("cs.patientName")
      .orderBy(sql`count(*)`, "desc")
      .orderBy("cs.patientName", "asc")
      .limit(15)
      .execute()
  ).map((r) => ({ patientName: String(r.name), count: Number(r.c) }));

  return {
    byStatus,
    totals: { imports, imported, pending, discovered, errors, rejected },
    matchRate,
    records: {
      total: Number(recordsTotal),
      withDate: Number(recordsWithDate),
    },
    byMonth,
    topDiagnoses,
    topPatients,
  };
}
