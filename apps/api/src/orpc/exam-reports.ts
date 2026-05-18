import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError, onError, os } from "@orpc/server";
import { db } from "@finanzas/db";
import { examReportsContract } from "@finanzas/orpc-contracts/exam-reports";
import { z } from "zod";

import { configureSuperjson } from "../lib/superjson-config.ts";
import { logError } from "../lib/logger.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

/**
 * Skin-test exam reports — server router. Implements the contract in
 * `@finanzas/orpc-contracts/exam-reports`. Three resource families:
 *   - exam reports CRUD
 *   - conclusion templates CRUD (admin)
 *   - clinic settings get/update (singleton)
 *   - allergen catalog read (proxy over ClinicalAllergen for the picker)
 */

const base = os.$context<Record<string, never>>();

// Decimal columns from Prisma serialise to a Decimal-like wrapper. The
// contract output is `number | null` so we coerce here. SuperJSON would
// also serialise Decimal natively but the intranet client validates the
// JSON shape with Zod and expects plain numbers.
function decimal(n: { toNumber: () => number } | null | undefined): number | null {
  return n == null ? null : n.toNumber();
}

const allergenSelect = {
  id: true,
  commonName: true,
  scientificName: true,
  category: true,
  pollenType: true,
  // Surfaced so the wizard + PDF generator can auto-fire the
  // cross-reactivity disclaimer when any tag matches PR-10 / profilin /
  // tropomyosin / LTP. Schema defaults to `[]` so older rows are safe.
  tags: true,
} as const;

const reportListSelect = {
  id: true,
  patientId: true,
  examType: true,
  conclusionText: true,
  doctorName: true,
  doctorSpecialty: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      person: {
        select: { names: true, fatherName: true, motherName: true, rut: true },
      },
    },
  },
} as const;

const reportDetailInclude = {
  patient: {
    select: {
      id: true,
      birthDate: true,
      person: {
        select: {
          names: true,
          fatherName: true,
          motherName: true,
          rut: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  sections: {
    orderBy: { position: "asc" as const },
    include: {
      reactions: {
        orderBy: { position: "asc" as const },
        include: { allergen: { select: allergenSelect } },
      },
    },
  },
} as const;

function serialiseDetail(r: any) {
  return {
    ...r,
    generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    patient: {
      ...r.patient,
      birthDate: r.patient.birthDate
        ? r.patient.birthDate.toISOString().slice(0, 10)
        : null,
    },
    sections: (r.sections ?? []).map((s: any) => ({
      ...s,
      reactions: (s.reactions ?? []).map((rx: any) => ({
        ...rx,
        papuleMm: decimal(rx.papuleMm),
      })),
    })),
  };
}

function serialiseList(r: any) {
  return {
    ...r,
    generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function serialiseTemplate(t: any) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serialiseSettings(s: any) {
  return {
    ...s,
    papuleThresholdMm: decimal(s.papuleThresholdMm) ?? 3,
    updatedAt: s.updatedAt.toISOString(),
  };
}

const examReportsRouterBase = {
  list: base
    .route({ method: "GET", path: "/", tags: ["ExamReports"] })
    .input(examReportsContract.list["~orpc"].inputSchema!)
    .output(examReportsContract.list["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = {};
      if (input?.patientId) where.patientId = input.patientId;
      if (input?.examType) where.examType = input.examType;
      if (input?.search) {
        const q = input.search.trim();
        if (q) {
          where.OR = [
            { conclusionText: { contains: q, mode: "insensitive" as const } },
            { patient: { person: { names: { contains: q, mode: "insensitive" as const } } } },
            { patient: { person: { rut: { contains: q, mode: "insensitive" as const } } } },
          ];
        }
      }
      if (input?.from || input?.to) {
        const range: { gte?: Date; lte?: Date } = {};
        if (input.from) range.gte = new Date(`${input.from}T00:00:00.000Z`);
        if (input.to) range.lte = new Date(`${input.to}T23:59:59.999Z`);
        where.createdAt = range;
      }
      const [items, total] = await Promise.all([
        db.examReport.findMany({
          where,
          select: reportListSelect,
          orderBy: { createdAt: "desc" },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0,
        }),
        db.examReport.count({ where }),
      ]);
      return { items: items.map(serialiseList), total };
    }),

  get: base
    .route({ method: "GET", path: "/{id}", tags: ["ExamReports"] })
    .input(examReportsContract.get["~orpc"].inputSchema!)
    .output(examReportsContract.get["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const report = await db.examReport.findUnique({
        where: { id: input.id },
        include: reportDetailInclude,
      });
      if (!report) throw new ORPCError("NOT_FOUND", { message: "Informe no encontrado" });
      return serialiseDetail(report);
    }),

  create: base
    .route({ method: "POST", path: "/", tags: ["ExamReports"] })
    .input(examReportsContract.create["~orpc"].inputSchema!)
    .output(examReportsContract.create["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const settings = await db.clinicSettings.findUnique({ where: { id: 1 } });
      if (!settings) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "ClinicSettings no inicializado",
        });
      }
      const created = await db.examReport.create({
        data: {
          patientId: input.patientId,
          examType: input.examType,
          conclusionText: input.conclusionText,
          conclusionTemplateId: input.conclusionTemplateId ?? null,
          reagents: input.reagents ?? settings.defaultReagents,
          technique: input.technique ?? settings.defaultTechnique,
          notes: input.notes ?? null,
          doctorName: input.doctorName ?? settings.doctorName,
          doctorSpecialty: input.doctorSpecialty ?? settings.doctorSpecialty,
          doctorRut: input.doctorRut ?? settings.doctorRut,
          sections: {
            create: input.sections.map((s, sIdx) => ({
              sectionKey: s.sectionKey,
              label: s.label,
              position: s.position ?? sIdx,
              reactions: {
                create: s.reactions.map((rx, rxIdx) => ({
                  allergenId: rx.allergenId,
                  reaction: rx.reaction,
                  papuleMm: rx.papuleMm ?? null,
                  notes: rx.notes ?? null,
                  position: rx.position ?? rxIdx,
                })),
              },
            })),
          },
        },
        include: reportDetailInclude,
      });
      return serialiseDetail(created);
    }),

  update: base
    .route({ method: "POST", path: "/{id}/update", tags: ["ExamReports"] })
    .input(examReportsContract.update["~orpc"].inputSchema!)
    .output(examReportsContract.update["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const { id, sections, ...rest } = input;
      // Replace sections wholesale on update — simpler than diffing.
      const updated = await db.$transaction(async (tx) => {
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) data[k] = v;
        }
        await tx.examReport.update({ where: { id }, data });
        if (sections) {
          await tx.examReportSection.deleteMany({ where: { examReportId: id } });
          for (const [sIdx, s] of sections.entries()) {
            await tx.examReportSection.create({
              data: {
                examReportId: id,
                sectionKey: s.sectionKey,
                label: s.label,
                position: s.position ?? sIdx,
                reactions: {
                  create: s.reactions.map((rx, rxIdx) => ({
                    allergenId: rx.allergenId,
                    reaction: rx.reaction,
                    papuleMm: rx.papuleMm ?? null,
                    notes: rx.notes ?? null,
                    position: rx.position ?? rxIdx,
                  })),
                },
              },
            });
          }
        }
        return tx.examReport.findUniqueOrThrow({
          where: { id },
          include: reportDetailInclude,
        });
      });
      return serialiseDetail(updated);
    }),

  delete: base
    .route({ method: "DELETE", path: "/{id}", tags: ["ExamReports"] })
    .input(examReportsContract.delete["~orpc"].inputSchema!)
    .output(examReportsContract.delete["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      await db.examReport.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),

  markGenerated: base
    .route({ method: "POST", path: "/{id}/mark-generated", tags: ["ExamReports"] })
    .input(examReportsContract.markGenerated["~orpc"].inputSchema!)
    .output(examReportsContract.markGenerated["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const updated = await db.examReport.update({
        where: { id: input.id },
        data: { generatedAt: new Date() },
        select: { generatedAt: true },
      });
      return { generatedAt: updated.generatedAt!.toISOString() };
    }),

  // ── Conclusion templates ──────────────────────────────────────────
  listTemplates: base
    .route({ method: "GET", path: "/templates", tags: ["ExamReports"] })
    .input(examReportsContract.listTemplates["~orpc"].inputSchema!)
    .output(examReportsContract.listTemplates["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input?.examType !== undefined) {
        where.OR = [{ examType: null }, { examType: input.examType }];
      }
      const templates = await db.conclusionTemplate.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { position: "asc" }, { createdAt: "asc" }],
      });
      return { templates: templates.map(serialiseTemplate) };
    }),

  createTemplate: base
    .route({ method: "POST", path: "/templates", tags: ["ExamReports"] })
    .input(examReportsContract.createTemplate["~orpc"].inputSchema!)
    .output(examReportsContract.createTemplate["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const created = await db.conclusionTemplate.create({
        data: {
          text: input.text,
          examType: input.examType ?? null,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
          position: input.position ?? 0,
        },
      });
      return serialiseTemplate(created);
    }),

  updateTemplate: base
    .route({ method: "POST", path: "/templates/{id}/update", tags: ["ExamReports"] })
    .input(examReportsContract.updateTemplate["~orpc"].inputSchema!)
    .output(examReportsContract.updateTemplate["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v;
      }
      const updated = await db.conclusionTemplate.update({ where: { id }, data });
      return serialiseTemplate(updated);
    }),

  deleteTemplate: base
    .route({ method: "DELETE", path: "/templates/{id}", tags: ["ExamReports"] })
    .input(examReportsContract.deleteTemplate["~orpc"].inputSchema!)
    .output(examReportsContract.deleteTemplate["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      await db.conclusionTemplate.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),

  // ── ClinicSettings (singleton) ────────────────────────────────────
  getClinicSettings: base
    .route({ method: "GET", path: "/clinic-settings", tags: ["ExamReports"] })
    .input(examReportsContract.getClinicSettings["~orpc"].inputSchema!)
    .output(examReportsContract.getClinicSettings["~orpc"].outputSchema!)
    .handler(async () => {
      const settings = await db.clinicSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
      return serialiseSettings(settings);
    }),

  updateClinicSettings: base
    .route({ method: "POST", path: "/clinic-settings/update", tags: ["ExamReports"] })
    .input(examReportsContract.updateClinicSettings["~orpc"].inputSchema!)
    .output(examReportsContract.updateClinicSettings["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) data[k] = v;
      }
      const updated = await db.clinicSettings.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data },
      });
      return serialiseSettings(updated);
    }),

  // ── Latest skin-test controls for a patient (XLSX SoT) ────────────
  // The wizard uses this to prefill the histamine + saline NumberFields
  // when a recent XLSX snapshot exists. Walks Patient → ClinicalSeries[]
  // → ClinicalSkinTest[] (ordered by testDate desc) → first one with at
  // least one POSITIVE or NEGATIVE control result. User can still
  // override manually in the wizard.
  latestPatientControls: base
    .route({ method: "GET", path: "/patients/{patientId}/latest-controls", tags: ["ExamReports"] })
    .input(examReportsContract.latestPatientControls["~orpc"].inputSchema!)
    .output(examReportsContract.latestPatientControls["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const series = await db.clinicalSeries.findMany({
        where: { patientId: input.patientId },
        select: { id: true },
      });
      if (series.length === 0) {
        return { histamineMm: null, salineMm: null, testDate: null, skinTestId: null };
      }
      const seriesIds = series.map((s) => s.id);
      // Pick the most recent skin test that actually has at least one
      // control row — otherwise we'd return nulls even though older
      // snapshots have valid controls.
      const skinTest = await db.clinicalSkinTest.findFirst({
        where: {
          clinicalSeriesId: { in: seriesIds },
          results: { some: { controlType: { not: null } } },
        },
        orderBy: { testDate: "desc" as const },
        select: {
          id: true,
          testDate: true,
          results: {
            where: { controlType: { not: null } },
            select: { controlType: true, papuleMm: true },
          },
        },
      });
      if (!skinTest) {
        return { histamineMm: null, salineMm: null, testDate: null, skinTestId: null };
      }
      // Prefer the largest mm value if duplicates exist (parser may emit
      // both "Control positivo" and "Histamina" rows for the same run).
      let hist: number | null = null;
      let sal: number | null = null;
      for (const r of skinTest.results) {
        const mm = r.papuleMm ?? null;
        if (mm == null) continue;
        if (r.controlType === "POSITIVE" && (hist == null || mm > hist)) hist = mm;
        if (r.controlType === "NEGATIVE" && (sal == null || mm > sal)) sal = mm;
      }
      return {
        histamineMm: hist,
        salineMm: sal,
        testDate: skinTest.testDate.toISOString().slice(0, 10),
        skinTestId: skinTest.id,
      };
    }),

  // ── Allergen catalog (read-only proxy) ────────────────────────────
  listAllergens: base
    .route({ method: "GET", path: "/allergens", tags: ["ExamReports"] })
    .input(examReportsContract.listAllergens["~orpc"].inputSchema!)
    .output(examReportsContract.listAllergens["~orpc"].outputSchema!)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input?.search) {
        const q = input.search.trim();
        if (q) {
          where.OR = [
            { commonName: { contains: q, mode: "insensitive" as const } },
            { scientificName: { contains: q, mode: "insensitive" as const } },
          ];
        }
      }
      if (input?.categories?.length) where.category = { in: input.categories };

      const [allergens, allCategories] = await Promise.all([
        db.clinicalAllergen.findMany({
          where,
          select: allergenSelect,
          orderBy: [{ category: "asc" }, { commonName: "asc" }],
          take: input?.limit ?? 200,
        }),
        db.clinicalAllergen.findMany({
          where: { isActive: true },
          select: { category: true },
          distinct: ["category"],
          orderBy: { category: "asc" },
        }),
      ]);
      return {
        allergens,
        categories: allCategories.map((c) => c.category).filter((c): c is string => Boolean(c)),
      };
    }),
};

export const examReportsORPCRouter = base
  .prefix("/api/orpc/exam-reports")
  .router(examReportsRouterBase);

export const examReportsORPCHandler = new SuperJSONRPCHandler(examReportsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("[exam-reports] handler error", error instanceof Error ? error : new Error(String(error)));
    }),
  ],
});

export const examReportsOpenAPIHandler = new OpenAPIHandler(examReportsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("[exam-reports] openapi handler error", error instanceof Error ? error : new Error(String(error)));
    }),
  ],
});
