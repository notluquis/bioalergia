import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Salud ocupacional (P7 stage-A) — captación de leads B2B de testeo de
 * drogas/alcohol + reactivos. `createLead` es público (sin auth, honeypot +
 * ratelimit); `listLeads`/`updateLeadStatus` requieren permiso sobre
 * `OccupationalLead`. El motor de testeo/cadena-de-custodia/confirmatorio
 * (stage-B) está bloqueado por revisión legal — no se modela aquí.
 */

export const occupationalSectorSchema = z.enum([
  "MINERIA",
  "TRANSPORTE",
  "CONSTRUCCION",
  "GENERAL",
  "OTRO",
]);

export const occupationalLeadStatusSchema = z.enum(["NUEVO", "CONTACTADO", "COTIZADO", "CERRADO"]);

// ── Lead público ─────────────────────────────────────────────────────
export const createOccupationalLeadInputSchema = z.object({
  empresa: z.string().min(1).max(200),
  contactName: z.string().min(1).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(40).nullable().optional(),
  rut: z.string().max(20).nullable().optional(),
  sector: occupationalSectorSchema.default("GENERAL"),
  headcount: z.number().int().min(1).max(1_000_000).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
  // Honeypot — debe venir vacío.
  website: z.string().max(0).optional(),
});

export const createOccupationalLeadResponseSchema = z.object({
  ok: z.literal(true),
  id: z.number().int(),
});

// ── Bandeja de leads (staff) ─────────────────────────────────────────
export const occupationalLeadSchema = z.object({
  id: z.number().int(),
  empresa: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  rut: z.string().nullable(),
  sector: occupationalSectorSchema,
  headcount: z.number().int().nullable(),
  message: z.string().nullable(),
  status: occupationalLeadStatusSchema,
  source: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const occupationalLeadListResponseSchema = z.object({
  leads: z.array(occupationalLeadSchema),
});
export const occupationalLeadResponseSchema = z.object({ lead: occupationalLeadSchema });
export const updateOccupationalLeadStatusInputSchema = z.object({
  id: z.number().int(),
  status: occupationalLeadStatusSchema,
});

// ── Programa ocupacional (stage-B seguro) ────────────────────────────
export const occupationalProgramStatusSchema = z.enum(["DRAFT", "ACTIVE", "SUSPENDED"]);
export const occupationalTestingScopeSchema = z.enum(["DRUGS", "ALCOHOL", "BOTH"]);

export const occupationalProgramSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  companyName: z.string().nullable(),
  sector: occupationalSectorSchema,
  testingScope: occupationalTestingScopeSchema,
  status: occupationalProgramStatusSchema,
  riohsAttested: z.boolean(),
  riohsClauseRef: z.string().nullable(),
  riohsAttestedAt: z.coerce.date().nullable(),
  riohsAttestedBy: z.number().int().nullable(),
  workerConsentBasis: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createOccupationalProgramInputSchema = z.object({
  companyId: z.number().int(),
  sector: occupationalSectorSchema.default("GENERAL"),
  testingScope: occupationalTestingScopeSchema.default("BOTH"),
  workerConsentBasis: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateOccupationalProgramInputSchema = z.object({
  id: z.number().int(),
  sector: occupationalSectorSchema.optional(),
  testingScope: occupationalTestingScopeSchema.optional(),
  workerConsentBasis: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const attestRiohsInputSchema = z.object({
  id: z.number().int(),
  // La cláusula RIOHS citada/referenciada por el cliente (CdT Art. 153/154).
  riohsClauseRef: z.string().min(1).max(2000),
});

export const setProgramStatusInputSchema = z.object({
  id: z.number().int(),
  status: occupationalProgramStatusSchema,
});

export const occupationalProgramListResponseSchema = z.object({
  programs: z.array(occupationalProgramSchema),
});
export const occupationalProgramResponseSchema = z.object({ program: occupationalProgramSchema });

// ── Lotes de resultado AGREGADO ──────────────────────────────────────
// `suppressed` = cohorte < umbral mínimo (k-anonimato) → conteos ocultos.
export const occupationalTestBatchSchema = z.object({
  id: z.number().int(),
  programId: z.number().int(),
  batchDate: z.coerce.date(),
  suppressed: z.boolean(),
  totalTested: z.number().int().nullable(),
  passedCount: z.number().int().nullable(),
  presumptivePositiveCount: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const createTestBatchInputSchema = z.object({
  programId: z.number().int(),
  batchDate: z.coerce.date(),
  totalTested: z.number().int().min(0).max(1_000_000),
  passedCount: z.number().int().min(0).max(1_000_000),
  presumptivePositiveCount: z.number().int().min(0).max(1_000_000),
  notes: z.string().max(2000).nullable().optional(),
});

export const listTestBatchesInputSchema = z.object({ programId: z.number().int() });
export const occupationalTestBatchListResponseSchema = z.object({
  batches: z.array(occupationalTestBatchSchema),
});
export const occupationalTestBatchResponseSchema = z.object({
  batch: occupationalTestBatchSchema,
});

// ── Contract ─────────────────────────────────────────────────────────
export const occupationalContract = {
  createLead: oc
    .route({ method: "POST", path: "/leads" })
    .input(createOccupationalLeadInputSchema)
    .output(createOccupationalLeadResponseSchema),
  listLeads: oc.route({ method: "GET", path: "/leads" }).output(occupationalLeadListResponseSchema),
  updateLeadStatus: oc
    .route({ method: "POST", path: "/leads/{id}/status" })
    .input(updateOccupationalLeadStatusInputSchema)
    .output(occupationalLeadResponseSchema),

  // ── Programa ocupacional (stage-B seguro) ──────────────────────────
  listPrograms: oc
    .route({ method: "GET", path: "/programs" })
    .output(occupationalProgramListResponseSchema),
  createProgram: oc
    .route({ method: "POST", path: "/programs" })
    .input(createOccupationalProgramInputSchema)
    .output(occupationalProgramResponseSchema),
  updateProgram: oc
    .route({ method: "POST", path: "/programs/{id}" })
    .input(updateOccupationalProgramInputSchema)
    .output(occupationalProgramResponseSchema),
  attestRiohs: oc
    .route({ method: "POST", path: "/programs/{id}/attest-riohs" })
    .input(attestRiohsInputSchema)
    .output(occupationalProgramResponseSchema),
  setProgramStatus: oc
    .route({ method: "POST", path: "/programs/{id}/status" })
    .input(setProgramStatusInputSchema)
    .output(occupationalProgramResponseSchema),
  // ── Lotes de resultado AGREGADO (sin PHI individual) ───────────────
  listTestBatches: oc
    .route({ method: "POST", path: "/programs/batches/list" })
    .input(listTestBatchesInputSchema)
    .output(occupationalTestBatchListResponseSchema),
  createTestBatch: oc
    .route({ method: "POST", path: "/programs/batches" })
    .input(createTestBatchInputSchema)
    .output(occupationalTestBatchResponseSchema),
};

export type OccupationalContract = typeof occupationalContract;
export type CreateOccupationalLeadInput = z.infer<typeof createOccupationalLeadInputSchema>;
export type OccupationalLeadDto = z.infer<typeof occupationalLeadSchema>;
export type OccupationalSector = z.infer<typeof occupationalSectorSchema>;
export type OccupationalLeadStatus = z.infer<typeof occupationalLeadStatusSchema>;
export type UpdateOccupationalLeadStatusInput = z.infer<
  typeof updateOccupationalLeadStatusInputSchema
>;
export type OccupationalProgramDto = z.infer<typeof occupationalProgramSchema>;
export type OccupationalProgramStatus2 = z.infer<typeof occupationalProgramStatusSchema>;
export type OccupationalTestingScope = z.infer<typeof occupationalTestingScopeSchema>;
export type CreateOccupationalProgramInput = z.infer<typeof createOccupationalProgramInputSchema>;
export type UpdateOccupationalProgramInput = z.infer<typeof updateOccupationalProgramInputSchema>;
export type AttestRiohsInput = z.infer<typeof attestRiohsInputSchema>;
export type SetProgramStatusInput = z.infer<typeof setProgramStatusInputSchema>;
export type OccupationalTestBatchDto = z.infer<typeof occupationalTestBatchSchema>;
export type CreateTestBatchInput = z.infer<typeof createTestBatchInputSchema>;
