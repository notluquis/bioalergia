import type { ClinicalSeriesKind, ClinicalSeriesStageKind } from "../types.ts";

export function buildSeriesDisplayName(params: {
  kind: ClinicalSeriesKind;
  patientName: null | string;
  patientRut: null | string;
}): string {
  const kindLabel =
    params.kind === "PATCH_TEST"
      ? "Test de parche"
      : params.kind === "SKIN_TEST"
        ? "Test cutáneo"
        : "Tratamiento subcutáneo";

  const identity = params.patientName ?? params.patientRut ?? "Paciente sin identificar";
  return `${identity} · ${kindLabel}`;
}

export function computeExpectedSessions(
  events: Array<{
    seriesStageKind: ClinicalSeriesStageKind | null;
    seriesStageNumber: null | number;
  }>
): null | number {
  const numbered = events
    .map((event) => event.seriesStageNumber)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (numbered.length > 0) {
    return Math.max(...numbered);
  }

  if (events.some((event) => event.seriesStageKind === "MAINTENANCE")) {
    return null;
  }

  return events.length > 0 ? events.length : null;
}
