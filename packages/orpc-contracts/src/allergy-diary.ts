import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * eDiary de síntomas — CSMS (Combined Symptom-Medication Score), estándar
 * EAACI/Pfaar 2014 (reafirmado 2025). Todo staff (auth + permiso). La
 * recolección directa del paciente está gateada por EIPD (docs/EIPD_EDIARY.md)
 * + consent purpose SYMPTOM_DIARY — no expuesta aún en superficie pública.
 *
 * Definición (golden 2026):
 *   dSS  = (6 síntomas, cada 0–3) / 6            → rango 0–3
 *   dMS  = mayor escalón de medicación de rescate → rango 0–3 (0 nada · 1 antiH ·
 *          2 corticoide intranasal · 3 corticoide oral)
 *   CSMS = dSS + dMS                              → rango 0–6
 *
 * El CSMS es CARGA SINTOMÁTICA AGREGADA para monitoreo/interpretación clínica,
 * NO un veredicto de eficacia ni un diagnóstico individual. Compute siempre
 * server-side; nunca se confía el puntaje del cliente.
 */

const score0to3 = z.number().int().min(0).max(3);

// Una entrada diaria, ya con los puntajes computados por el service.
export const diaryEntrySchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  entryDate: z.coerce.date(),
  sneezing: score0to3,
  rhinorrhea: score0to3,
  nasalItching: score0to3,
  nasalCongestion: score0to3,
  eyeItchingRedness: score0to3,
  eyeWatering: score0to3,
  medAntihistamine: z.boolean(),
  medIntranasalSteroid: z.boolean(),
  medOralSteroid: z.boolean(),
  dSS: z.number(),
  dMS: z.number().int(),
  csms: z.number(),
  isComplete: z.boolean(),
  notes: z.string().nullable(),
  enteredBy: z.number().int().nullable(),
  createdAt: z.coerce.date(),
});

// Input de upsert (una entrada por paciente+día). Los puntajes NO se aceptan
// del cliente: el service los computa. `notes` opcional, ≤500.
export const upsertDiaryEntryInputSchema = z.object({
  patientId: z.number().int(),
  entryDate: z.coerce.date(),
  sneezing: score0to3,
  rhinorrhea: score0to3,
  nasalItching: score0to3,
  nasalCongestion: score0to3,
  eyeItchingRedness: score0to3,
  eyeWatering: score0to3,
  medAntihistamine: z.boolean().default(false),
  medIntranasalSteroid: z.boolean().default(false),
  medOralSteroid: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export const listDiaryEntriesInputSchema = z.object({
  patientId: z.number().int(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const deleteDiaryEntryInputSchema = z.object({ id: z.number().int() });

// Agregado de temporada: promedios sobre los días REGISTRADOS (los días
// faltantes se excluyen, NO se imputan 0). `completionRate` = registrados /
// días de la ventana; `isValidSeason` exige ≥80% (de-facto EAACI, confirmar
// con el alergólogo la ventana polínica exacta).
export const diarySeasonInputSchema = z.object({
  patientId: z.number().int(),
  seasonStart: z.coerce.date(),
  seasonEnd: z.coerce.date(),
});
export const diarySeasonSchema = z.object({
  patientId: z.number().int(),
  seasonStart: z.coerce.date(),
  seasonEnd: z.coerce.date(),
  windowDays: z.number().int(),
  recordedDays: z.number().int(),
  completionRate: z.number(),
  isValidSeason: z.boolean(),
  avgDSS: z.number().nullable(),
  avgDMS: z.number().nullable(),
  avgCsms: z.number().nullable(),
});

export const diaryEntryResponseSchema = z.object({ entry: diaryEntrySchema });
export const diaryEntryListResponseSchema = z.object({
  entries: z.array(diaryEntrySchema),
  season: diarySeasonSchema.nullable(),
});

export const allergyDiaryContract = {
  upsertEntry: oc
    .route({ method: "POST", path: "/entries" })
    .input(upsertDiaryEntryInputSchema)
    .output(diaryEntryResponseSchema),
  listEntries: oc
    .route({ method: "POST", path: "/entries/list" })
    .input(listDiaryEntriesInputSchema)
    .output(diaryEntryListResponseSchema),
  season: oc
    .route({ method: "POST", path: "/season" })
    .input(diarySeasonInputSchema)
    .output(diarySeasonSchema),
  deleteEntry: oc
    .route({ method: "POST", path: "/entries/{id}/delete" })
    .input(deleteDiaryEntryInputSchema)
    .output(z.object({ ok: z.literal(true) })),
};

export type AllergyDiaryContract = typeof allergyDiaryContract;
export type DiaryEntryDto = z.infer<typeof diaryEntrySchema>;
export type UpsertDiaryEntryInput = z.infer<typeof upsertDiaryEntryInputSchema>;
export type DiarySeasonDto = z.infer<typeof diarySeasonSchema>;
