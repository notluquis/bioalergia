import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Skin-test exam reports — generic structured medical reports printable
 * as PDF. Five exam types share the same polymorphic shape:
 *   PATCH                  — Test de Parche (lecturas 48h y 96h)
 *   MULTITEST_PANELS       — Multitest Panel 1, 2, 3 y Acaros
 *   FOOD_PANEL             — Panel Alimentario I
 *   AEROALLERGENS_I/II     — Aeroalergenos (Acaros, Epitelios, Polenes…)
 *
 * Each report carries one or more *sections* (e.g. "Primera lectura
 * 48 horas", "PANEL 1", "POLENES > ARBOLES"); each section carries
 * one or more *reactions* — an allergen + the operator's clinical
 * reading (NEGATIVA/DEBIL/MODERADA/FUERTE) + optional papule mm.
 *
 * Footer info (clinic name, address, phones, doctor signature) lives
 * in `clinicSettings` and conclusion phrases live in
 * `conclusionTemplates` so the PDF never has hardcoded strings.
 */

// ── Enums (mirror the Prisma enums in schema.zmodel) ─────────────────
export const examTypeSchema = z.enum([
  "PATCH",
  "MULTITEST_PANELS",
  "FOOD_PANEL",
  "AEROALLERGENS_I",
  "AEROALLERGENS_II",
]);
export type ExamType = z.infer<typeof examTypeSchema>;

export const skinReactionSchema = z.enum(["NEGATIVA", "DEBIL", "MODERADA", "FUERTE"]);
export type SkinReaction = z.infer<typeof skinReactionSchema>;

// ── Shared schemas ───────────────────────────────────────────────────

export const reactionInputSchema = z.object({
  allergenId: z.string().min(1),
  reaction: skinReactionSchema,
  papuleMm: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
});

export const sectionInputSchema = z.object({
  sectionKey: z.string().min(1),
  label: z.string().min(1),
  position: z.number().int().nonnegative().optional(),
  reactions: z.array(reactionInputSchema).default([]),
});

const allergenLiteSchema = z.object({
  id: z.string(),
  commonName: z.string(),
  scientificName: z.string().nullable(),
  category: z.string(),
  pollenType: z.string().nullable(),
  // Free-form tags from ClinicalAllergen.tags — surfaced so the PDF
  // generator can auto-fire the cross-reactivity disclaimer when any
  // tag matches PR-10 / profilin / tropomyosin / LTP. Default `[]`
  // keeps older API builds backwards-compatible.
  tags: z.array(z.string()).default([]),
});

const reactionOutputSchema = z.object({
  id: z.number().int(),
  allergenId: z.string(),
  reaction: skinReactionSchema,
  papuleMm: z.number().nullable(),
  notes: z.string().nullable(),
  position: z.number().int(),
  allergen: allergenLiteSchema,
});

const sectionOutputSchema = z.object({
  id: z.number().int(),
  sectionKey: z.string(),
  label: z.string(),
  position: z.number().int(),
  reactions: z.array(reactionOutputSchema),
});

const examReportListItemSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  examType: examTypeSchema,
  conclusionText: z.string(),
  doctorName: z.string(),
  doctorSpecialty: z.string(),
  generatedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  patient: z.object({
    id: z.number().int(),
    person: z.object({
      names: z.string(),
      fatherName: z.string().nullable(),
      motherName: z.string().nullable(),
      rut: z.string().nullable(),
    }),
  }),
});

export const examReportDetailSchema = examReportListItemSchema.extend({
  conclusionTemplateId: z.number().int().nullable(),
  reagents: z.string().nullable(),
  technique: z.string().nullable(),
  notes: z.string().nullable(),
  doctorRut: z.string().nullable(),
  // Persisted controls (mm pápula). Nullable because columns were added
  // additively — old reports return `null` for both.
  histamineMm: z.number().nullable(),
  salineMm: z.number().nullable(),
  createdById: z.number().int().nullable(),
  patient: z.object({
    id: z.number().int(),
    birthDate: z.iso.date().nullable(),
    person: z.object({
      names: z.string(),
      fatherName: z.string().nullable(),
      motherName: z.string().nullable(),
      rut: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }),
  }),
  sections: z.array(sectionOutputSchema),
});

const examReportCreateInputSchema = z.object({
  patientId: z.number().int().positive(),
  examType: examTypeSchema,
  conclusionText: z.string().min(1),
  conclusionTemplateId: z.number().int().nullable().optional(),
  reagents: z.string().nullable().optional(),
  technique: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Optional doctor overrides — fall back to ClinicSettings.doctor* on the server.
  doctorName: z.string().optional(),
  doctorSpecialty: z.string().optional(),
  doctorRut: z.string().nullable().optional(),
  // Operator-confirmed control mm values; either prefilled from the
  // most recent XLSX skin-test snapshot or typed manually. Both
  // optional — wizard may submit either, both, or neither.
  histamineMm: z.number().nonnegative().nullable().optional(),
  salineMm: z.number().nonnegative().nullable().optional(),
  sections: z.array(sectionInputSchema).min(1),
});

const examReportUpdateInputSchema = examReportCreateInputSchema.partial().extend({
  id: z.number().int().positive(),
});

// ── ConclusionTemplate (admin-managed) ───────────────────────────────

export const conclusionTemplateSchema = z.object({
  id: z.number().int(),
  text: z.string(),
  examType: examTypeSchema.nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const conclusionTemplateCreateInputSchema = z.object({
  text: z.string().min(1),
  examType: examTypeSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});

// Update accepts any subset — the toggle UI patches only `isDefault`
// or `isActive` without re-sending `text`.
const conclusionTemplateUpdateInputSchema = conclusionTemplateCreateInputSchema
  .partial()
  .extend({ id: z.number().int().positive() });

// ── ClinicSettings (singleton) ───────────────────────────────────────

export const clinicSettingsSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  address: z.string(),
  phoneWhatsapp: z.string(),
  phoneLandline: z.string(),
  email: z.string(),
  website: z.string(),
  websiteSecondary: z.string(),
  defaultReagents: z.string(),
  defaultTechnique: z.string(),
  doctorName: z.string(),
  doctorSpecialty: z.string(),
  doctorRut: z.string().nullable(),
  signatureUrl: z.string().nullable(),
  papuleThresholdMm: z.number(),
  // Prestador Superintendencia de Salud N — printed under doctor's
  // signature block on every exam-report PDF.
  superintendenciaNumber: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

const clinicSettingsUpdateInputSchema = clinicSettingsSchema
  .omit({ id: true, updatedAt: true })
  .partial();

// ── Allergen catalog (read-only, filtered) ───────────────────────────

const allergenListInputSchema = z
  .object({
    search: z.string().optional(),
    categories: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(500).optional(),
  })
  .partial();

const allergenListOutputSchema = z.object({
  allergens: z.array(allergenLiteSchema),
  // Distinct categories present in the dataset — useful for the picker
  // groupings ("Polenes > Arboles", "Acaros", "Epitelios", etc).
  categories: z.array(z.string()),
});

// ── Latest skin-test controls (XLSX source-of-truth for wizard) ──────
//
// Lets the wizard prefill the histamine + saline control mm fields
// from the most recent imported XLSX skin-test for the patient (joined
// via Patient → ClinicalSeries[] → ClinicalSkinTest[] →
// ClinicalSkinTestResult[controlType]). Returns nulls when no snapshot
// exists yet; the wizard falls back to manual entry.
const latestPatientControlsInputSchema = z.object({
  patientId: z.number().int().positive(),
});

const latestPatientControlsOutputSchema = z.object({
  histamineMm: z.number().nullable(),
  salineMm: z.number().nullable(),
  /** ISO date of the source skin-test (YYYY-MM-DD), null if no snapshot. */
  testDate: z.iso.date().nullable(),
  /** Source skin-test id so the UI can link/debug. */
  skinTestId: z.string().nullable(),
});

// ── Contract ─────────────────────────────────────────────────────────

export const examReportsContract = {
  list: oc
    .route({ method: "GET", path: "/" })
    .input(
      z
        .object({
          patientId: z.number().int().positive().optional(),
          examType: examTypeSchema.optional(),
          search: z.string().optional(),
          // ISO date (YYYY-MM-DD) inclusive bounds on createdAt. UI binds
          // these to a DateRangePicker; server interprets `to` as the
          // end-of-day to keep the range inclusive.
          from: z.iso.date().optional(),
          to: z.iso.date().optional(),
          limit: z.number().int().positive().max(500).optional(),
          offset: z.number().int().nonnegative().optional(),
        })
        .partial()
    )
    .output(z.object({ items: z.array(examReportListItemSchema), total: z.number().int() })),

  get: oc
    .route({ method: "GET", path: "/{id}" })
    .input(z.object({ id: z.number().int().positive() }))
    .output(examReportDetailSchema),

  create: oc
    .route({ method: "POST", path: "/" })
    .input(examReportCreateInputSchema)
    .output(examReportDetailSchema),

  update: oc
    .route({ method: "POST", path: "/{id}/update" })
    .input(examReportUpdateInputSchema)
    .output(examReportDetailSchema),

  delete: oc
    .route({ method: "DELETE", path: "/{id}" })
    .input(z.object({ id: z.number().int().positive() }))
    .output(z.object({ ok: z.literal(true) })),

  markGenerated: oc
    .route({ method: "POST", path: "/{id}/mark-generated" })
    .input(z.object({ id: z.number().int().positive() }))
    .output(z.object({ generatedAt: z.iso.datetime() })),

  // ConclusionTemplate CRUD (admin)
  listTemplates: oc
    .route({ method: "GET", path: "/templates" })
    .input(z.object({ examType: examTypeSchema.nullable().optional() }).partial())
    .output(z.object({ templates: z.array(conclusionTemplateSchema) })),

  createTemplate: oc
    .route({ method: "POST", path: "/templates" })
    .input(conclusionTemplateCreateInputSchema)
    .output(conclusionTemplateSchema),

  updateTemplate: oc
    .route({ method: "POST", path: "/templates/{id}/update" })
    .input(conclusionTemplateUpdateInputSchema)
    .output(conclusionTemplateSchema),

  deleteTemplate: oc
    .route({ method: "DELETE", path: "/templates/{id}" })
    .input(z.object({ id: z.number().int().positive() }))
    .output(z.object({ ok: z.literal(true) })),

  // ClinicSettings (singleton)
  getClinicSettings: oc
    .route({ method: "GET", path: "/clinic-settings" })
    .input(z.object({}))
    .output(clinicSettingsSchema),

  updateClinicSettings: oc
    .route({ method: "POST", path: "/clinic-settings/update" })
    .input(clinicSettingsUpdateInputSchema)
    .output(clinicSettingsSchema),

  // Allergen catalog (read-only — wraps the existing ClinicalAllergen
  // table so the wizard's picker has a single endpoint without
  // duplicating clinical-skin-tests' contract surface).
  listAllergens: oc
    .route({ method: "GET", path: "/allergens" })
    .input(allergenListInputSchema)
    .output(allergenListOutputSchema),

  latestPatientControls: oc
    .route({ method: "GET", path: "/patients/{patientId}/latest-controls" })
    .input(latestPatientControlsInputSchema)
    .output(latestPatientControlsOutputSchema),
};

export type ExamReportsContract = typeof examReportsContract;
