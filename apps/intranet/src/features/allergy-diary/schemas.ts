import { z } from "zod";

/**
 * Validación local de respuestas del API allergy-diary (convención repo:
 * intranet valida con schemas.ts local, NO con el orpc-contract).
 * Fechas superjson = z.coerce.date(). Mantener en sync con el contrato
 * `@finanzas/orpc-contracts/allergy-diary` al cambiar el modelo.
 */

const score0to3 = z.number().int().min(0).max(3);

export const diaryEntrySchema = z.strictObject({
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

export const diarySeasonSchema = z.strictObject({
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

export const diaryEntryResponseSchema = z.strictObject({ entry: diaryEntrySchema });

export const diaryEntryListResponseSchema = z.strictObject({
  entries: z.array(diaryEntrySchema),
  season: diarySeasonSchema.nullable(),
});

export const deleteDiaryEntryResponseSchema = z.strictObject({ ok: z.literal(true) });

export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type DiarySeason = z.infer<typeof diarySeasonSchema>;
