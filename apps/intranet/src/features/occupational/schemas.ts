import { z } from "zod";

// ── Validación local de respuestas API ────────────────────────────────
// Convención intranet: las respuestas se validan con schemas locales
// (z.strictObject), NO con el contrato oRPC. Fechas superjson = z.coerce.date().

const occupationalSectorSchema = z.enum([
  "MINERIA",
  "TRANSPORTE",
  "CONSTRUCCION",
  "GENERAL",
  "OTRO",
]);
const occupationalProgramStatusSchema = z.enum(["DRAFT", "ACTIVE", "SUSPENDED"]);
const occupationalTestingScopeSchema = z.enum(["DRUGS", "ALCOHOL", "BOTH"]);

export const OccupationalProgramSchema = z.strictObject({
  id: z.number(),
  companyId: z.number(),
  companyName: z.string().nullable(),
  sector: occupationalSectorSchema,
  testingScope: occupationalTestingScopeSchema,
  status: occupationalProgramStatusSchema,
  riohsAttested: z.boolean(),
  riohsClauseRef: z.string().nullable(),
  riohsAttestedAt: z.coerce.date().nullable(),
  riohsAttestedBy: z.number().nullable(),
  workerConsentBasis: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const OccupationalTestBatchSchema = z.strictObject({
  id: z.number(),
  programId: z.number(),
  batchDate: z.coerce.date(),
  suppressed: z.boolean(),
  totalTested: z.number().nullable(),
  passedCount: z.number().nullable(),
  presumptivePositiveCount: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const OccupationalSchemas = {
  ProgramListResponse: z.strictObject({
    programs: z.array(OccupationalProgramSchema),
  }),
  ProgramResponse: z.strictObject({
    program: OccupationalProgramSchema,
  }),
  TestBatchListResponse: z.strictObject({
    batches: z.array(OccupationalTestBatchSchema),
  }),
  TestBatchResponse: z.strictObject({
    batch: OccupationalTestBatchSchema,
  }),
};

export type OccupationalProgram = z.infer<typeof OccupationalProgramSchema>;
export type OccupationalTestBatch = z.infer<typeof OccupationalTestBatchSchema>;
