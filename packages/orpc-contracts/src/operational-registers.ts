import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Registros operativos / sanitarios que la clínica debe mantener para la SEREMI
 * (DS 283, BIO-RG-001, REAS DS 6/2009, DS 44/2024). Un único modelo
 * (`OperationalRegister`) cubre los 7 tipos; los campos específicos por tipo se
 * guardan en la columna `data` (Json).
 *
 * Todos los endpoints son de STAFF (no hay endpoint público): requieren el
 * subject CASL dedicado `OperationalRegister`.
 */

export const registerTypeSchema = z.enum([
  "COLD_CHAIN",
  "REAS",
  "TRAINING",
  "EPP_DELIVERY",
  "OMPP",
  "R_AIT",
  "NONCONFORMITY",
]);

export const nonconformityStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]);

// Unión discriminada por `registerType`. Cada variante lleva `occurredAt` (ISO),
// un `notes` opcional y sus campos tipados.
const coldChainVariant = z.object({
  registerType: z.literal("COLD_CHAIN"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  tempC: z.number(),
  minC: z.number().optional(),
  maxC: z.number().optional(),
  withinRange: z.boolean(),
  correctiveAction: z.string().optional(),
});

const reasVariant = z.object({
  registerType: z.literal("REAS"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  movement: z.enum(["INGRESO", "RETIRO"]),
  wasteType: z.string().min(1),
  quantityKg: z.number(),
  destination: z.string().optional(),
  guideNumber: z.string().optional(),
});

const trainingVariant = z.object({
  registerType: z.literal("TRAINING"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  topic: z.string().min(1),
  facilitator: z.string().optional(),
  attendees: z.array(z.string()),
  durationHours: z.number().optional(),
});

const eppDeliveryVariant = z.object({
  registerType: z.literal("EPP_DELIVERY"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  item: z.string().min(1),
  recipient: z.string().min(1),
  quantity: z.number().int(),
  signedBy: z.string().optional(),
});

const omppVariant = z.object({
  registerType: z.literal("OMPP"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  procedure: z.string().min(1),
  delegatedTo: z.string().min(1),
  validUntil: z.string().optional(),
  signedBy: z.string().optional(),
});

const rAitVariant = z.object({
  registerType: z.literal("R_AIT"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  patientRef: z.string().min(1),
  allergen: z.string().min(1),
  dose: z.string().min(1),
  reaction: z.string().optional(),
  observationMin: z.number().optional(),
});

const nonconformityVariant = z.object({
  registerType: z.literal("NONCONFORMITY"),
  occurredAt: z.string(),
  notes: z.string().optional(),
  description: z.string().min(1),
  rootCause: z.string().optional(),
  action: z.string().optional(),
  responsible: z.string().optional(),
  dueAt: z.string().optional(),
});

export const createOperationalRegisterInputSchema = z.discriminatedUnion("registerType", [
  coldChainVariant,
  reasVariant,
  trainingVariant,
  eppDeliveryVariant,
  omppVariant,
  rAitVariant,
  nonconformityVariant,
]);

export const operationalRegisterSchema = z.object({
  id: z.string(),
  registerType: registerTypeSchema,
  occurredAt: z.coerce.date(),
  summary: z.string(),
  data: z.record(z.string(), z.unknown()),
  status: nonconformityStatusSchema.nullable(),
  dueAt: z.coerce.date().nullable(),
  attachmentUrl: z.string().nullable(),
  signedBy: z.string().nullable(),
  recordedBy: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const listOperationalRegistersInputSchema = z.object({
  registerType: registerTypeSchema.optional(),
  status: nonconformityStatusSchema.optional(),
});

export const operationalRegistersResponseSchema = z.object({
  registers: z.array(operationalRegisterSchema),
});

export const closeNonconformityInputSchema = z.object({
  id: z.string().min(1),
  status: nonconformityStatusSchema,
  resolution: z.string().optional(),
});

export const operationalRegistersContract = {
  create: oc
    .route({ method: "POST", path: "/registers" })
    .input(createOperationalRegisterInputSchema)
    .output(operationalRegisterSchema),
  list: oc
    .route({ method: "GET", path: "/registers" })
    .input(listOperationalRegistersInputSchema)
    .output(operationalRegistersResponseSchema),
  closeNonconformity: oc
    .route({ method: "POST", path: "/registers/close-nonconformity" })
    .input(closeNonconformityInputSchema)
    .output(operationalRegisterSchema),
};

export type OperationalRegistersContract = typeof operationalRegistersContract;
export type OperationalRegisterDto = z.infer<typeof operationalRegisterSchema>;
export type RegisterType = z.infer<typeof registerTypeSchema>;
export type NonconformityStatus = z.infer<typeof nonconformityStatusSchema>;
export type CreateOperationalRegisterInput = z.infer<typeof createOperationalRegisterInputSchema>;
export type ListOperationalRegistersInput = z.infer<typeof listOperationalRegistersInputSchema>;
export type CloseNonconformityInput = z.infer<typeof closeNonconformityInputSchema>;
