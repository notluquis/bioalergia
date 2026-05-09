import { db } from "@finanzas/db";
import { parseCalendarMetadata } from "./parsers.ts";

export const MISSING_CLASSIFICATION_FILTERS = [
  { key: "missingCategory", label: "Sin categoría" },
  { key: "missingAmountExpected", label: "Sin monto esperado" },
  { key: "missingAmountPaid", label: "Sin monto pagado" },
  { key: "missingAttended", label: "Sin asistencia" },
  { key: "missingDosage", label: "Sin dosis" },
  { key: "missingTreatmentStage", label: "Sin etapa" },
] as const;

export type MissingClassificationFilterKey = (typeof MISSING_CLASSIFICATION_FILTERS)[number]["key"];

export const MISSING_QUERY_TO_SERVICE_FILTER = {
  missingAmountExpected: "amountExpected",
  missingAmountPaid: "amountPaid",
  missingAttended: "attended",
  missingCategory: "category",
  missingDosage: "dosageValue",
  missingTreatmentStage: "treatmentStage",
} as const;

export type TestMetadata = {
  firstReading: boolean;
  patchTest: boolean;
  secondReading: boolean;
  skinTest: boolean;
  thirdReading: boolean;
};

export function isMissingClassificationFilterKey(
  value: string,
): value is MissingClassificationFilterKey {
  return MISSING_CLASSIFICATION_FILTERS.some((filter) => filter.key === value);
}

export function toTestMetadata(value: unknown): null | TestMetadata {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<TestMetadata>;
  if (
    typeof candidate.firstReading !== "boolean" ||
    typeof candidate.patchTest !== "boolean" ||
    typeof candidate.secondReading !== "boolean" ||
    typeof candidate.skinTest !== "boolean" ||
    typeof candidate.thirdReading !== "boolean"
  ) {
    return null;
  }

  return {
    firstReading: candidate.firstReading,
    patchTest: candidate.patchTest,
    secondReading: candidate.secondReading,
    skinTest: candidate.skinTest,
    thirdReading: candidate.thirdReading,
  };
}

type JobQueueModule = Awaited<typeof import("../lib/jobQueue.ts")>;
type JobQueueFns = Pick<JobQueueModule, "completeJob" | "failJob" | "updateJobProgress">;

type PartialReclassifyEvent = {
  id: number;
  summary: null | string;
  description: null | string;
  clinicalSeriesId: null | number;
  category: null | string;
  seriesStageKind: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  dosageValue: null | number;
  dosageUnit: null | string;
  treatmentStage: null | string;
  attended: boolean | null;
  amountExpected: null | number;
  amountPaid: null | number;
  controlIncluded: boolean;
  isDomicilio: boolean;
  testMetadata: null | TestMetadata;
};

type FullReclassifyEvent = {
  id: number;
  summary: null | string;
  description: null | string;
  clinicalSeriesId: null | number;
  controlIncluded: boolean;
};

type PartialReclassifyUpdateData = {
  clinicalSeriesId?: number | null;
  category?: string;
  seriesStageKind?: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel?: string | null;
  seriesStageNumber?: number | null;
  dosageValue?: number;
  dosageUnit?: string;
  treatmentStage?: string;
  attended?: boolean;
  amountExpected?: number;
  amountPaid?: number;
  controlIncluded?: boolean;
  isDomicilio?: boolean;
  testMetadata?: TestMetadata;
};

type FullReclassifyUpdateData = {
  clinicalSeriesId: null | number;
  category: null | string;
  seriesStageKind: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel: null | string;
  seriesStageNumber: null | number;
  dosageValue: null | number;
  dosageUnit: null | string;
  treatmentStage: null | string;
  attended: boolean | null;
  amountExpected: null | number;
  amountPaid: null | number;
  controlIncluded: boolean;
  isDomicilio: boolean;
  testMetadata?: TestMetadata;
};

type PartialFieldCounts = {
  amountExpected: number;
  amountPaid: number;
  attended: number;
  category: number;
  controlIncluded: number;
  dosage: number;
  isDomicilio: number;
  treatmentStage: number;
};

type FullFieldCounts = {
  amountExpected: number;
  amountPaid: number;
  attended: number;
  category: number;
  controlIncluded: number;
  dosageUnit: number;
  dosageValue: number;
  isDomicilio: number;
  treatmentStage: number;
};

const createPartialFieldCounts = (): PartialFieldCounts => ({
  amountExpected: 0,
  amountPaid: 0,
  attended: 0,
  category: 0,
  controlIncluded: 0,
  dosage: 0,
  isDomicilio: 0,
  treatmentStage: 0,
});

const createFullFieldCounts = (): FullFieldCounts => ({
  amountExpected: 0,
  amountPaid: 0,
  attended: 0,
  category: 0,
  controlIncluded: 0,
  dosageUnit: 0,
  dosageValue: 0,
  isDomicilio: 0,
  treatmentStage: 0,
});

const parseMetadata = (event: { description: null | string; summary: null | string }) => {
  return parseCalendarMetadata({
    summary: event.summary,
    description: event.description,
  });
};

type ParsedCalendarMetadata = ReturnType<typeof parseCalendarMetadata>;

const CATEGORY_REPAIRABLE_CLINICAL_SET = new Set([
  "Test y exámenes",
  "Tratamiento subcutáneo",
]);

const applyPartialCategoryUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  const shouldRepairClinicalCategory =
    metadata.category != null &&
    event.category != null &&
    event.category !== "" &&
    event.category !== metadata.category &&
    CATEGORY_REPAIRABLE_CLINICAL_SET.has(event.category) &&
    CATEGORY_REPAIRABLE_CLINICAL_SET.has(metadata.category);

  if (
    (((event.category === null || event.category === "") && metadata.category != null) ||
      shouldRepairClinicalCategory) &&
    metadata.category != null
  ) {
    updateData.category = metadata.category;
    fieldCounts.category++;
  }
};

const applyPartialSeriesStageUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
) => {
  if (event.seriesStageKind == null && metadata.seriesStageKind) {
    updateData.seriesStageKind = metadata.seriesStageKind;
  }
  if (event.seriesStageLabel == null && metadata.seriesStageLabel) {
    updateData.seriesStageLabel = metadata.seriesStageLabel;
  }
  if (event.seriesStageNumber == null && metadata.seriesStageNumber != null) {
    updateData.seriesStageNumber = metadata.seriesStageNumber;
  }
};

const applyPartialDosageUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  if ((event.dosageValue === null || event.dosageUnit === null) && metadata.dosageValue !== null) {
    updateData.dosageValue = metadata.dosageValue;
    updateData.dosageUnit = metadata.dosageUnit ?? "ml";
    fieldCounts.dosage++;
  }
};

const applyPartialTreatmentStageUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  if (event.treatmentStage === null && metadata.treatmentStage) {
    updateData.treatmentStage = metadata.treatmentStage;
    fieldCounts.treatmentStage++;
  }
};

const applyPartialAttendedUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  if (event.attended === null && metadata.attended !== null) {
    updateData.attended = metadata.attended;
    fieldCounts.attended++;
  }
};

const applyPartialAmountExpectedUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  if (event.amountExpected === null && metadata.amountExpected !== null) {
    updateData.amountExpected = metadata.amountExpected;
    fieldCounts.amountExpected++;
  }
};

const applyPartialAmountPaidUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  const shouldRepairLegacyZero =
    event.amountPaid === 0 &&
    event.attended === true &&
    metadata.amountPaid !== null &&
    metadata.amountPaid > 0;

  if ((event.amountPaid === null || shouldRepairLegacyZero) && metadata.amountPaid !== null) {
    updateData.amountPaid = metadata.amountPaid;
    fieldCounts.amountPaid++;
  }
};

const applyPartialControlIncludedUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  if (metadata.controlIncluded && event.controlIncluded === false) {
    updateData.controlIncluded = true;
    fieldCounts.controlIncluded++;
  }
};

const applyPartialDomicilioUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
  fieldCounts: PartialFieldCounts,
) => {
  if (metadata.isDomicilio && event.isDomicilio === false) {
    updateData.isDomicilio = true;
    fieldCounts.isDomicilio++;
  }
};

const applyPartialTestMetadataUpdate = (
  event: PartialReclassifyEvent,
  metadata: ParsedCalendarMetadata,
  updateData: PartialReclassifyUpdateData,
) => {
  if (metadata.testMetadata && event.testMetadata == null) {
    updateData.testMetadata = metadata.testMetadata;
  }
};

const buildPartialUpdateData = (
  event: PartialReclassifyEvent,
  fieldCounts: PartialFieldCounts,
): PartialReclassifyUpdateData => {
  const updateData: PartialReclassifyUpdateData = {};
  const metadata = parseMetadata(event);

  applyPartialCategoryUpdate(event, metadata, updateData, fieldCounts);
  applyPartialSeriesStageUpdate(event, metadata, updateData);
  applyPartialDosageUpdate(event, metadata, updateData, fieldCounts);
  applyPartialTreatmentStageUpdate(event, metadata, updateData, fieldCounts);
  applyPartialAttendedUpdate(event, metadata, updateData, fieldCounts);
  applyPartialAmountExpectedUpdate(event, metadata, updateData, fieldCounts);
  applyPartialAmountPaidUpdate(event, metadata, updateData, fieldCounts);
  applyPartialControlIncludedUpdate(event, metadata, updateData, fieldCounts);
  applyPartialDomicilioUpdate(event, metadata, updateData, fieldCounts);
  applyPartialTestMetadataUpdate(event, metadata, updateData);

  return updateData;
};

const buildFullUpdateData = (
  event: FullReclassifyEvent,
  fieldCounts: FullFieldCounts,
): FullReclassifyUpdateData => {
  const metadata = parseMetadata(event);

  if (metadata.category) {
    fieldCounts.category++;
  }
  if (metadata.dosageValue !== null) {
    fieldCounts.dosageValue++;
  }
  if (metadata.dosageUnit) {
    fieldCounts.dosageUnit++;
  }
  if (metadata.treatmentStage) {
    fieldCounts.treatmentStage++;
  }
  if (metadata.attended !== null) {
    fieldCounts.attended++;
  }
  if (metadata.amountExpected !== null) {
    fieldCounts.amountExpected++;
  }
  if (metadata.amountPaid !== null) {
    fieldCounts.amountPaid++;
  }
  if (metadata.controlIncluded) {
    fieldCounts.controlIncluded++;
  }
  if (metadata.isDomicilio) {
    fieldCounts.isDomicilio++;
  }

  return {
    clinicalSeriesId: event.clinicalSeriesId ?? null,
    category: metadata.category,
    seriesStageKind: metadata.seriesStageKind,
    seriesStageLabel: metadata.seriesStageLabel,
    seriesStageNumber: metadata.seriesStageNumber,
    dosageValue: metadata.dosageValue,
    dosageUnit: metadata.dosageUnit,
    treatmentStage: metadata.treatmentStage,
    attended: metadata.attended,
    amountExpected: metadata.amountExpected,
    amountPaid: metadata.amountPaid,
    controlIncluded: metadata.controlIncluded,
    isDomicilio: metadata.isDomicilio,
    ...(metadata.testMetadata ? { testMetadata: metadata.testMetadata } : {}),
  };
};

async function persistEventUpdates<TData extends Record<string, unknown>>(params: {
  eventsLength: number;
  jobId: string;
  progressEveryBatches?: number;
  updates: Array<{ data: TData; id: number }>;
  updateJobProgress: JobQueueFns["updateJobProgress"];
}) {
  const batchSize = 20;
  let processed = 0;

  for (let i = 0; i < params.updates.length; i += batchSize) {
    const batch = params.updates.slice(i, i + batchSize);
    await db.$transaction(batch.map((u) => db.event.update({ where: { id: u.id }, data: u.data })));
    processed += batch.length;

    const shouldNotify =
      params.progressEveryBatches == null ||
      params.progressEveryBatches <= 1 ||
      (i / batchSize) % params.progressEveryBatches === 0 ||
      i + batchSize >= params.updates.length;

    if (shouldNotify) {
      params.updateJobProgress(
        params.jobId,
        params.eventsLength,
        `Guardando ${processed}/${params.updates.length} actualizaciones...`,
      );
    }
  }
}

async function runReclassifyMissingFieldsJob(
  events: PartialReclassifyEvent[],
  jobId: string,
  jobQueue: JobQueueFns,
) {
  try {
    const updates: Array<{ data: PartialReclassifyUpdateData; id: number }> = [];
    const fieldCounts = createPartialFieldCounts();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const updateData = buildPartialUpdateData(event, fieldCounts);

      if (Object.keys(updateData).length > 0) {
        updates.push({ id: event.id, data: updateData });
      }

      if (i % 50 === 0 || i === events.length - 1) {
        jobQueue.updateJobProgress(jobId, i + 1, `Analizando ${i + 1}/${events.length} eventos...`);
      }
    }

    await persistEventUpdates({
      eventsLength: events.length,
      jobId,
      updates,
      updateJobProgress: jobQueue.updateJobProgress,
    });

    jobQueue.completeJob(jobId, {
      message: `Reclassified ${updates.length} events`,
      totalChecked: events.length,
      reclassified: updates.length,
      fieldCounts,
    });
  } catch (err) {
    jobQueue.failJob(jobId, err instanceof Error ? err.message : "Unknown error");
  }
}

async function runReclassifyAllJob(
  events: FullReclassifyEvent[],
  jobId: string,
  jobQueue: JobQueueFns,
) {
  try {
    const updates: Array<{ data: FullReclassifyUpdateData; id: number }> = [];
    const fieldCounts = createFullFieldCounts();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const updateData = buildFullUpdateData(event, fieldCounts);
      updates.push({ id: event.id, data: updateData });

      if (i % 100 === 0 || i === events.length - 1) {
        jobQueue.updateJobProgress(jobId, i + 1, `Analizando ${i + 1}/${events.length} eventos...`);
      }
    }

    await persistEventUpdates({
      eventsLength: events.length,
      jobId,
      progressEveryBatches: 5,
      updates,
      updateJobProgress: jobQueue.updateJobProgress,
    });

    jobQueue.completeJob(jobId, {
      message: `Reclassified all ${updates.length} events`,
      totalChecked: events.length,
      reclassified: updates.length,
      fieldCounts,
    });
  } catch (err) {
    jobQueue.failJob(jobId, err instanceof Error ? err.message : "Unknown error");
  }
}

export async function startReclassifyMissingFieldsJob(input?: {
  filterMode?: "AND" | "OR";
  missing?: MissingClassificationFilterKey[];
}) {
  const { startJob, updateJobProgress, completeJob, failJob } = await import("../lib/jobQueue.ts");
  const selectedMissingFilters = new Set<MissingClassificationFilterKey>(input?.missing ?? []);
  const filterMode = input?.filterMode ?? "OR";
  const now = new Date();

  const selectedConditions: Record<string, unknown>[] = [];
  if (selectedMissingFilters.has("missingCategory")) {
    selectedConditions.push({ OR: [{ category: null }, { category: "" }] });
  }
  if (selectedMissingFilters.has("missingAmountExpected")) {
    selectedConditions.push({ amountExpected: null });
  }
  if (selectedMissingFilters.has("missingAmountPaid")) {
    selectedConditions.push({ amountPaid: null });
  }
  if (selectedMissingFilters.has("missingAttended")) {
    selectedConditions.push({ attended: null, startDateTime: { lte: now } });
  }
  if (selectedMissingFilters.has("missingDosage")) {
    selectedConditions.push({
      category: "Tratamiento subcutáneo",
      dosageValue: null,
    });
  }
  if (selectedMissingFilters.has("missingTreatmentStage")) {
    selectedConditions.push({
      category: "Tratamiento subcutáneo",
      OR: [{ treatmentStage: null }, { treatmentStage: "" }],
    });
  }

  const where =
    selectedConditions.length > 0
      ? filterMode === "AND"
        ? { AND: selectedConditions }
        : { OR: selectedConditions }
      : {
          OR: [
            { category: null },
            { category: "" },
            { dosageValue: null },
            { treatmentStage: null },
            { attended: null },
            { amountExpected: null },
            { amountPaid: null },
          ],
        };

  const events = await db.event.findMany({
    where,
    select: {
      id: true,
      summary: true,
      description: true,
      clinicalSeriesId: true,
      category: true,
      dosageValue: true,
      dosageUnit: true,
      seriesStageKind: true,
      seriesStageLabel: true,
      seriesStageNumber: true,
      treatmentStage: true,
      attended: true,
      amountExpected: true,
      amountPaid: true,
      controlIncluded: true,
      isDomicilio: true,
      testMetadata: true,
    },
  });

  const normalizedEvents: PartialReclassifyEvent[] = events.map((event) => ({
    ...event,
    testMetadata: toTestMetadata(event.testMetadata),
  }));

  const jobId = startJob("reclassify", normalizedEvents.length);

  void runReclassifyMissingFieldsJob(normalizedEvents, jobId, {
    completeJob,
    failJob,
    updateJobProgress,
  });

  return { jobId, totalEvents: normalizedEvents.length };
}

export async function startReclassifyAllEventsJob() {
  const { startJob, updateJobProgress, completeJob, failJob } = await import("../lib/jobQueue.ts");

  const events = await db.event.findMany({
    select: {
      id: true,
      summary: true,
      description: true,
      clinicalSeriesId: true,
      controlIncluded: true,
    },
  });

  const jobId = startJob("reclassify-all", events.length);

  void runReclassifyAllJob(events, jobId, {
    completeJob,
    failJob,
    updateJobProgress,
  });

  return { jobId, totalEvents: events.length };
}

export async function getCalendarJobStatus(jobId: string) {
  const { getJobStatus } = await import("../lib/jobQueue.ts");
  return getJobStatus(jobId);
}
