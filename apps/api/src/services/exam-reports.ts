import { db } from "@finanzas/db";
import type { examReportsContract } from "@finanzas/orpc-contracts/exam-reports";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { dbDateToISO } from "../lib/time.ts";

// Lógica DB de exam reports, fuera de los handlers oRPC (golden 2026: handlers
// finos). Los servicios hacen las queries/transacciones, lanzan DomainError
// (mapeado a HTTP por orpc/error.ts::toORPCError) y devuelven el payload ya
// serializado al shape del contrato. Mantener el db.$transaction acá (contexto
// de tipos liviano) evita el TS2321 del TransactionClientContract profundo.

type Contract = typeof examReportsContract;
type Input<K extends keyof Contract> = z.infer<NonNullable<Contract[K]["~orpc"]["inputSchema"]>>;

// ── Query shapes ──────────────────────────────────────────────────────────
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

// Row types derived from the actual ZenStack query shapes so the serialisers
// are fully typed (no `any`). The serialisers convert Decimal columns
// (`{ toNumber() }`) → number and Date → ISO string.
const _reportDetailRow = () =>
  db.examReport.findUniqueOrThrow({ where: { id: 0 }, include: reportDetailInclude });
type ReportDetailRow = Awaited<ReturnType<typeof _reportDetailRow>>;

const _reportListRow = () => db.examReport.findMany({ select: reportListSelect });
type ReportListRow = Awaited<ReturnType<typeof _reportListRow>>[number];

type SectionRow = ReportDetailRow["sections"][number];
type ReactionRow = SectionRow["reactions"][number];
type TemplateRow = Awaited<ReturnType<typeof db.conclusionTemplate.findFirst>>;
type SettingsRow = NonNullable<Awaited<ReturnType<typeof db.clinicSettings.findUnique>>>;

// Decimal columns serialise to a Decimal-like wrapper; the contract output is
// `number | null` so coerce here (intranet validates the JSON shape with Zod).
function decimal(n: { toNumber: () => number } | null | undefined): number | null {
  return n == null ? null : n.toNumber();
}

function serialiseDetail(r: ReportDetailRow) {
  return {
    ...r,
    histamineMm: decimal(r.histamineMm),
    salineMm: decimal(r.salineMm),
    generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    patient: {
      ...r.patient,
      birthDate: dbDateToISO(r.patient.birthDate),
    },
    sections: (r.sections ?? []).map((s: SectionRow) => ({
      ...s,
      reactions: (s.reactions ?? []).map((rx: ReactionRow) => ({
        ...rx,
        papuleMm: decimal(rx.papuleMm),
      })),
    })),
  };
}

function serialiseList(r: ReportListRow) {
  return {
    ...r,
    generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function serialiseTemplate(t: NonNullable<TemplateRow>) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serialiseSettings(s: SettingsRow) {
  return {
    ...s,
    papuleThresholdMm: decimal(s.papuleThresholdMm) ?? 3,
    latitude: decimal(s.latitude),
    longitude: decimal(s.longitude),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ── Exam reports ────────────────────────────────────────────────────────
type ListResponse = z.infer<NonNullable<Contract["list"]["~orpc"]["outputSchema"]>>;
type DetailResponse = z.infer<NonNullable<Contract["get"]["~orpc"]["outputSchema"]>>;

export async function listExamReports(input: Input<"list">): Promise<ListResponse> {
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
  return { items: items.map((r) => serialiseList(r)), total };
}

export async function getExamReport(input: Input<"get">): Promise<DetailResponse> {
  const report = await db.examReport.findUnique({
    where: { id: input.id },
    include: reportDetailInclude,
  });
  if (!report) throw new DomainError("NOT_FOUND", "Informe no encontrado");
  return serialiseDetail(report);
}

export async function createExamReport(input: Input<"create">): Promise<DetailResponse> {
  const settings = await db.clinicSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    throw new DomainError("UNPROCESSABLE_ENTITY", "ClinicSettings no inicializado");
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
      histamineMm: input.histamineMm ?? null,
      salineMm: input.salineMm ?? null,
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
}

export async function applyExamReportUpdate(input: Input<"update">): Promise<void> {
  const { id, sections, ...rest } = input;
  // Replace sections wholesale on update — simpler than diffing.
  await db.$transaction(async (tx) => {
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
  });
}

// Update sections then re-read the detail to return the serialised shape.
export async function updateExamReport(input: Input<"update">): Promise<DetailResponse> {
  await applyExamReportUpdate(input);
  const updated = await db.examReport.findUniqueOrThrow({
    where: { id: input.id },
    include: reportDetailInclude,
  });
  return serialiseDetail(updated);
}

export async function deleteExamReport(input: Input<"delete">): Promise<void> {
  await db.examReport.delete({ where: { id: input.id } });
}

export async function markExamReportGenerated(
  input: Input<"markGenerated">
): Promise<{ generatedAt: string }> {
  const updated = await db.examReport.update({
    where: { id: input.id },
    data: { generatedAt: new Date() },
    select: { generatedAt: true },
  });
  const { generatedAt } = updated;
  return { generatedAt: (generatedAt ?? new Date()).toISOString() };
}

// ── Conclusion templates ──────────────────────────────────────────────────
type ListTemplatesResponse = z.infer<
  NonNullable<Contract["listTemplates"]["~orpc"]["outputSchema"]>
>;
type TemplateResponse = z.infer<NonNullable<Contract["createTemplate"]["~orpc"]["outputSchema"]>>;

export async function listConclusionTemplates(
  input: Input<"listTemplates">
): Promise<ListTemplatesResponse> {
  const where: Record<string, unknown> = { isActive: true };
  if (input?.examType !== undefined) {
    where.OR = [{ examType: null }, { examType: input.examType }];
  }
  const templates = await db.conclusionTemplate.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  return { templates: templates.map((t) => serialiseTemplate(t)) };
}

export async function createConclusionTemplate(
  input: Input<"createTemplate">
): Promise<TemplateResponse> {
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
}

export async function updateConclusionTemplate(
  input: Input<"updateTemplate">
): Promise<TemplateResponse> {
  const { id, ...rest } = input;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  const updated = await db.conclusionTemplate.update({ where: { id }, data });
  return serialiseTemplate(updated);
}

export async function deleteConclusionTemplate(input: Input<"deleteTemplate">): Promise<void> {
  await db.conclusionTemplate.delete({ where: { id: input.id } });
}

// ── ClinicSettings (singleton) ─────────────────────────────────────────────
type SettingsResponse = z.infer<
  NonNullable<Contract["getClinicSettings"]["~orpc"]["outputSchema"]>
>;

export async function getClinicSettings(): Promise<SettingsResponse> {
  const settings = await db.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return serialiseSettings(settings);
}

export async function updateClinicSettings(
  input: Input<"updateClinicSettings">
): Promise<SettingsResponse> {
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
}

// ── Latest skin-test controls for a patient (XLSX SoT) ──────────────────────
type LatestControlsResponse = z.infer<
  NonNullable<Contract["latestPatientControls"]["~orpc"]["outputSchema"]>
>;

// Walks Patient → ClinicalSeries[] → ClinicalSkinTest[] (testDate desc) → first
// with at least one POSITIVE/NEGATIVE control. Prefills the wizard's histamine +
// saline NumberFields; the user can still override.
export async function getLatestPatientControls(
  input: Input<"latestPatientControls">
): Promise<LatestControlsResponse> {
  const series = await db.clinicalSeries.findMany({
    where: { patientId: input.patientId },
    select: { id: true },
  });
  if (series.length === 0) {
    return { histamineMm: null, salineMm: null, testDate: null, skinTestId: null };
  }
  const seriesIds = series.map((s) => s.id);
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
  // Prefer the largest mm value if duplicates exist (parser may emit both
  // "Control positivo" and "Histamina" rows for the same run).
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
    testDate: dbDateToISO(skinTest.testDate),
    skinTestId: skinTest.id,
  };
}

// ── Allergen tag editor (admin) ─────────────────────────────────────────────
type AllergensWithTagsResponse = z.infer<
  NonNullable<Contract["listAllergensWithTags"]["~orpc"]["outputSchema"]>
>;
type AllergenAdminRow = z.infer<
  NonNullable<Contract["updateAllergenTags"]["~orpc"]["outputSchema"]>
>;

export async function listAllergensWithTags(
  input: Input<"listAllergensWithTags">
): Promise<AllergensWithTagsResponse> {
  const where: Record<string, unknown> = {};
  if (input?.search) {
    const q = input.search.trim();
    if (q) {
      where.OR = [
        { commonName: { contains: q, mode: "insensitive" as const } },
        { scientificName: { contains: q, mode: "insensitive" as const } },
        // Allow searching by category code too (e.g. "polen").
        { category: { contains: q, mode: "insensitive" as const } },
      ];
    }
  }
  if (input?.onlyTagged) {
    // ZenStack `isEmpty: false` compiles to `tags != '{}'` (correct for empty arrays).
    where.tags = { isEmpty: false };
  }
  const [items, total] = await Promise.all([
    db.clinicalAllergen.findMany({
      where,
      select: { ...allergenSelect, isActive: true },
      orderBy: [{ category: "asc" }, { commonName: "asc" }],
      take: input?.limit ?? 50,
      skip: input?.offset ?? 0,
    }),
    db.clinicalAllergen.count({ where }),
  ]);
  return { items, total };
}

export async function updateAllergenTags(
  input: Input<"updateAllergenTags">
): Promise<AllergenAdminRow> {
  // De-dupe tags (combobox may emit the same string twice via paste); preserve
  // insertion order for a human-friendly diff in the audit log.
  const dedup = Array.from(new Set(input.tags));
  try {
    return await db.clinicalAllergen.update({
      where: { id: input.id },
      data: { tags: dedup },
      select: { ...allergenSelect, isActive: true },
    });
  } catch (e) {
    // P2025 = row not found → translate to 404 so the panel shows the right toast.
    if ((e as { code?: string }).code === "P2025") {
      throw new DomainError("NOT_FOUND", "Alérgeno no encontrado");
    }
    throw e;
  }
}

// ── Allergen catalog (read-only proxy) ──────────────────────────────────────
type AllergenListResponse = z.infer<
  NonNullable<Contract["listAllergens"]["~orpc"]["outputSchema"]>
>;

export async function listAllergens(input: Input<"listAllergens">): Promise<AllergenListResponse> {
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
}
