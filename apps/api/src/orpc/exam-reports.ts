import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError, os } from "@orpc/server";
import {
  allergenListInputSchema,
  allergenListOutputSchema,
  allergenAdminRowSchema,
  clinicSettingsSchema,
  clinicSettingsUpdateInputSchema,
  presignClinicAssetInputSchema,
  presignClinicAssetResponseSchema,
  conclusionTemplateSchema,
  conclusionTemplateCreateInputSchema,
  conclusionTemplateUpdateInputSchema,
  emptyInputSchema,
  examReportDetailSchema,
  examReportCreateInputSchema,
  examReportIdInputSchema,
  examReportListInputSchema,
  examReportListResponseSchema,
  examReportUpdateInputSchema,
  latestPatientControlsInputSchema,
  latestPatientControlsOutputSchema,
  listAllergensWithTagsInputSchema,
  listAllergensWithTagsOutputSchema,
  listTemplatesInputSchema,
  examReportListTemplatesResponseSchema,
  markGeneratedResponseSchema,
  examReportOkResponseSchema,
  updateAllergenTagsInputSchema,
} from "@finanzas/orpc-contracts/exam-reports";

import {
  createConclusionTemplate,
  createExamReport,
  deleteConclusionTemplate,
  deleteExamReport,
  getClinicSettings,
  getExamReport,
  getLatestPatientControls,
  listAllergens,
  listAllergensWithTags,
  listConclusionTemplates,
  listExamReports,
  markExamReportGenerated,
  updateAllergenTags,
  updateClinicSettings,
  updateConclusionTemplate,
  updateExamReport,
} from "../services/exam-reports.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { logError } from "../lib/logger.ts";
import { logAuditFromContext } from "../lib/audit-log.ts";
import { getSessionUser } from "../lib/auth.ts";
import type { Context as HonoContext } from "hono";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

/**
 * Skin-test exam reports — server router (golden 2026: handlers finos). Toda la
 * lógica DB + serialización vive en `services/exam-reports.ts`; los handlers
 * validan input (contrato Zod) → llaman el servicio → devuelven. El servicio
 * lanza DomainError (mapeado a HTTP por toORPCError). Cuatro familias:
 *   - exam reports CRUD
 *   - conclusion templates CRUD (admin)
 *   - clinic settings get/update (singleton)
 *   - allergen catalog read (proxy over ClinicalAllergen for the picker)
 */

const base = os.$context<{ hono: HonoContext }>();

const examReportsRouterBase = {
  list: base
    .route({ method: "GET", path: "/", tags: ["ExamReports"] })
    .input(examReportListInputSchema)
    .output(examReportListResponseSchema)
    .handler(({ input }) => listExamReports(input)),

  get: base
    .route({ method: "GET", path: "/{id}", tags: ["ExamReports"] })
    .input(examReportIdInputSchema)
    .output(examReportDetailSchema)
    .handler(async ({ context, input }) => {
      const report = await getExamReport(input);
      // Acceso a documento clínico (Decreto 41/2012 art. 9 + Ley 20.584).
      // Fire-and-forget: nunca suma latencia ni rompe la lectura.
      const user = await getSessionUser(context.hono);
      void logAuditFromContext(context.hono, {
        kind: "CLINICAL_DOCUMENT_VIEW",
        userId: user?.id ?? null,
        actorLabel: user?.email ?? null,
        resource: "ExamReport",
        resourceId: input.id,
        message: "exam-report:get",
      });
      return report;
    }),

  create: base
    .route({ method: "POST", path: "/", tags: ["ExamReports"] })
    .input(examReportCreateInputSchema)
    .output(examReportDetailSchema)
    .handler(({ input }) => createExamReport(input)),

  update: base
    .route({ method: "POST", path: "/{id}/update", tags: ["ExamReports"] })
    .input(examReportUpdateInputSchema)
    .output(examReportDetailSchema)
    .handler(({ input }) => updateExamReport(input)),

  delete: base
    .route({ method: "DELETE", path: "/{id}", tags: ["ExamReports"] })
    .input(examReportIdInputSchema)
    .output(examReportOkResponseSchema)
    .handler(async ({ input }) => {
      await deleteExamReport(input);
      return { ok: true as const };
    }),

  markGenerated: base
    .route({ method: "POST", path: "/{id}/mark-generated", tags: ["ExamReports"] })
    .input(examReportIdInputSchema)
    .output(markGeneratedResponseSchema)
    .handler(({ input }) => markExamReportGenerated(input)),

  // ── Conclusion templates ──────────────────────────────────────────
  listTemplates: base
    .route({ method: "GET", path: "/templates", tags: ["ExamReports"] })
    .input(listTemplatesInputSchema)
    .output(examReportListTemplatesResponseSchema)
    .handler(({ input }) => listConclusionTemplates(input)),

  createTemplate: base
    .route({ method: "POST", path: "/templates", tags: ["ExamReports"] })
    .input(conclusionTemplateCreateInputSchema)
    .output(conclusionTemplateSchema)
    .handler(({ input }) => createConclusionTemplate(input)),

  updateTemplate: base
    .route({ method: "POST", path: "/templates/{id}/update", tags: ["ExamReports"] })
    .input(conclusionTemplateUpdateInputSchema)
    .output(conclusionTemplateSchema)
    .handler(({ input }) => updateConclusionTemplate(input)),

  deleteTemplate: base
    .route({ method: "DELETE", path: "/templates/{id}", tags: ["ExamReports"] })
    .input(examReportIdInputSchema)
    .output(examReportOkResponseSchema)
    .handler(async ({ input }) => {
      await deleteConclusionTemplate(input);
      return { ok: true as const };
    }),

  // ── ClinicSettings (singleton) ────────────────────────────────────
  getClinicSettings: base
    .route({ method: "GET", path: "/clinic-settings", tags: ["ExamReports"] })
    .input(emptyInputSchema)
    .output(clinicSettingsSchema)
    .handler(() => getClinicSettings()),

  updateClinicSettings: base
    .route({ method: "POST", path: "/clinic-settings/update", tags: ["ExamReports"] })
    .input(clinicSettingsUpdateInputSchema)
    .output(clinicSettingsSchema)
    .handler(({ input }) => updateClinicSettings(input)),

  presignClinicAsset: base
    .route({ method: "POST", path: "/clinic-settings/presign-asset", tags: ["ExamReports"] })
    .input(presignClinicAssetInputSchema)
    .output(presignClinicAssetResponseSchema)
    .handler(async ({ input }) => {
      // Module orchestration (R2 presign), not DB — stays in the handler.
      const { presignClinicAssetUpload } = await import("../modules/cloudflare/r2.ts");
      const result = await presignClinicAssetUpload({
        kind: input.kind,
        filename: input.filename,
        contentType: input.contentType,
      });
      return { url: result.url, cdnUrl: result.cdnUrl, r2Key: result.r2Key };
    }),

  // ── Latest skin-test controls for a patient (XLSX SoT) ────────────
  latestPatientControls: base
    .route({ method: "GET", path: "/patients/{patientId}/latest-controls", tags: ["ExamReports"] })
    .input(latestPatientControlsInputSchema)
    .output(latestPatientControlsOutputSchema)
    .handler(({ input }) => getLatestPatientControls(input)),

  // ── Allergen tag editor (admin) ───────────────────────────────────
  listAllergensWithTags: base
    .route({ method: "GET", path: "/allergens/admin", tags: ["ExamReports"] })
    .input(listAllergensWithTagsInputSchema)
    .output(listAllergensWithTagsOutputSchema)
    .handler(({ input }) => listAllergensWithTags(input)),

  updateAllergenTags: base
    .route({ method: "POST", path: "/allergens/{id}/tags", tags: ["ExamReports"] })
    .input(updateAllergenTagsInputSchema)
    .output(allergenAdminRowSchema)
    .handler(({ input }) => updateAllergenTags(input)),

  // ── Allergen catalog (read-only proxy) ────────────────────────────
  listAllergens: base
    .route({ method: "GET", path: "/allergens", tags: ["ExamReports"] })
    .input(allergenListInputSchema)
    .output(allergenListOutputSchema)
    .handler(({ input }) => listAllergens(input)),
};

export const examReportsORPCRouter = base
  .prefix("/api/orpc/exam-reports")
  .router(examReportsRouterBase);

export const examReportsORPCHandler = new SuperJSONRPCHandler(examReportsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(
        "[exam-reports] handler error",
        error instanceof Error ? error : new Error(String(error))
      );
    }),
  ],
});

export const examReportsOpenAPIHandler = new OpenAPIHandler(examReportsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(
        "[exam-reports] openapi handler error",
        error instanceof Error ? error : new Error(String(error))
      );
    }),
  ],
});
