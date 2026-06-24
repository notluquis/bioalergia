import { db } from "@finanzas/db";
import type { DiarySeasonDto, UpsertDiaryEntryInput } from "@finanzas/orpc-contracts/allergy-diary";
import { DomainError } from "../lib/errors.ts";
import { dbDateToISO, isoToDbDate } from "../lib/time.ts";

type DiaryRow = NonNullable<Awaited<ReturnType<typeof db.allergyDiaryEntry.findUnique>>>;

// ── Scoring CSMS (EAACI/Pfaar 2014) ──────────────────────────────────
// dSS = (6 síntomas, cada 0–3) / 6 → 0–3. Redondeo a 2 decimales para evitar
// ruido flotante (la suma cruda es 0–18).
export function computeDSS(s: {
  sneezing: number;
  rhinorrhea: number;
  nasalItching: number;
  nasalCongestion: number;
  eyeItchingRedness: number;
  eyeWatering: number;
}): number {
  const sum =
    s.sneezing +
    s.rhinorrhea +
    s.nasalItching +
    s.nasalCongestion +
    s.eyeItchingRedness +
    s.eyeWatering;
  return Math.round((sum / 6) * 100) / 100;
}

// dMS = MAYOR escalón de medicación de rescate usado ese día (no aditivo):
// 3 corticoide oral · 2 corticoide intranasal · 1 antihistamínico · 0 nada.
export function computeDMS(m: {
  medAntihistamine: boolean;
  medIntranasalSteroid: boolean;
  medOralSteroid: boolean;
}): number {
  if (m.medOralSteroid) return 3;
  if (m.medIntranasalSteroid) return 2;
  if (m.medAntihistamine) return 1;
  return 0;
}

// CSMS = dSS + dMS → 0–6 (ponderación igual, cada componente 0–3).
export function computeScores(input: {
  sneezing: number;
  rhinorrhea: number;
  nasalItching: number;
  nasalCongestion: number;
  eyeItchingRedness: number;
  eyeWatering: number;
  medAntihistamine: boolean;
  medIntranasalSteroid: boolean;
  medOralSteroid: boolean;
}): { dSS: number; dMS: number; csms: number } {
  const dSS = computeDSS(input);
  const dMS = computeDMS(input);
  return { dSS, dMS, csms: Math.round((dSS + dMS) * 100) / 100 };
}

// ── Serializer ───────────────────────────────────────────────────────
export function serializeDiaryEntry(e: DiaryRow) {
  return {
    id: e.id,
    patientId: e.patientId,
    entryDate: e.entryDate,
    sneezing: e.sneezing,
    rhinorrhea: e.rhinorrhea,
    nasalItching: e.nasalItching,
    nasalCongestion: e.nasalCongestion,
    eyeItchingRedness: e.eyeItchingRedness,
    eyeWatering: e.eyeWatering,
    medAntihistamine: e.medAntihistamine,
    medIntranasalSteroid: e.medIntranasalSteroid,
    medOralSteroid: e.medOralSteroid,
    dSS: e.dSS,
    dMS: e.dMS,
    csms: e.csms,
    isComplete: e.isComplete,
    notes: e.notes,
    enteredBy: e.enteredBy,
    createdAt: e.createdAt,
  };
}

// entry_date es @db.Date → anclar a UTC-medianoche (canónico, evita rollback de TZ).
function normalizeEntryDate(d: Date): Date {
  const iso = dbDateToISO(d);
  if (!iso) throw new DomainError("BAD_REQUEST", "entryDate inválida");
  return isoToDbDate(iso);
}

// ── Upsert (una entrada por paciente+día) ────────────────────────────
export async function upsertEntry(input: UpsertDiaryEntryInput, enteredBy: number | null) {
  const entryDate = normalizeEntryDate(input.entryDate);
  const scores = computeScores(input);
  const data = {
    sneezing: input.sneezing,
    rhinorrhea: input.rhinorrhea,
    nasalItching: input.nasalItching,
    nasalCongestion: input.nasalCongestion,
    eyeItchingRedness: input.eyeItchingRedness,
    eyeWatering: input.eyeWatering,
    medAntihistamine: input.medAntihistamine,
    medIntranasalSteroid: input.medIntranasalSteroid,
    medOralSteroid: input.medOralSteroid,
    dSS: scores.dSS,
    dMS: scores.dMS,
    csms: scores.csms,
    // Los 6 síntomas son requeridos por el contrato → entrada completa.
    isComplete: true,
    notes: input.notes?.trim() || null,
  };
  return db.allergyDiaryEntry.upsert({
    where: { patientId_entryDate: { patientId: input.patientId, entryDate } },
    update: data,
    create: { patientId: input.patientId, entryDate, enteredBy, ...data },
  });
}

// ── Lectura ──────────────────────────────────────────────────────────
export async function listEntries(input: { patientId: number; from?: Date; to?: Date }) {
  const where: {
    patientId: number;
    entryDate?: { gte?: Date; lte?: Date };
  } = { patientId: input.patientId };
  if (input.from || input.to) {
    where.entryDate = {};
    if (input.from) where.entryDate.gte = normalizeEntryDate(input.from);
    if (input.to) where.entryDate.lte = normalizeEntryDate(input.to);
  }
  return db.allergyDiaryEntry.findMany({ where, orderBy: { entryDate: "asc" } });
}

// ── Agregado de temporada ────────────────────────────────────────────
// Promedios SOLO sobre días registrados (faltantes excluidos, NO imputados 0).
// completionRate = registrados / días de la ventana; válida si ≥80%.
export async function seasonAggregate(input: {
  patientId: number;
  seasonStart: Date;
  seasonEnd: Date;
}): Promise<DiarySeasonDto> {
  const start = normalizeEntryDate(input.seasonStart);
  const end = normalizeEntryDate(input.seasonEnd);
  if (end < start) throw new DomainError("BAD_REQUEST", "seasonEnd anterior a seasonStart");

  const rows = await db.allergyDiaryEntry.findMany({
    where: { patientId: input.patientId, entryDate: { gte: start, lte: end } },
    select: { dSS: true, dMS: true, csms: true },
  });

  const MS_PER_DAY = 86_400_000;
  const windowDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const recordedDays = rows.length;
  const completionRate = windowDays > 0 ? Math.round((recordedDays / windowDays) * 1000) / 1000 : 0;

  const avg = (pick: (r: (typeof rows)[number]) => number): number | null => {
    if (recordedDays === 0) return null;
    const total = rows.reduce((acc, r) => acc + pick(r), 0);
    return Math.round((total / recordedDays) * 100) / 100;
  };

  return {
    patientId: input.patientId,
    seasonStart: start,
    seasonEnd: end,
    windowDays,
    recordedDays,
    completionRate,
    isValidSeason: completionRate >= 0.8,
    avgDSS: avg((r) => r.dSS),
    avgDMS: avg((r) => r.dMS),
    avgCsms: avg((r) => r.csms),
  };
}

export async function deleteEntry(id: number) {
  const existing = await db.allergyDiaryEntry.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Entrada no encontrada");
  await db.allergyDiaryEntry.delete({ where: { id } });
  return { ok: true as const };
}
