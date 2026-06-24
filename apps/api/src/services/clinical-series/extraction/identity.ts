import { normalizeClinicalText } from "../../../lib/clinical-text.ts";
import { normalizeRut } from "../../../lib/rut.ts";

import { RUT_REGEX } from "../constants.ts";
import { isLikelyPersonName } from "../normalization/names.ts";
import { sanitizeRut } from "../normalization/rut.ts";
import type { ClinicalIdentity, StoredClinicalIdentity } from "../types.ts";

import { extractNamesFromText, isAcceptedRutCandidate } from "./names.ts";
import {
  extractStructuredClinicalDescription,
  normalizeIdentitySourceText,
  stripStructuredNoiseForNames,
} from "./structured.ts";

export function hasIdentitySourceText(summary: null | string, description: null | string): boolean {
  return Boolean(normalizeClinicalText(summary) || normalizeClinicalText(description));
}

export function extractIdentityHints(
  summary: null | string,
  description: null | string
): {
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  patientName: null | string;
  patientRut: null | string;
} {
  const summaryText = normalizeIdentitySourceText(normalizeClinicalText(summary));
  const descriptionText = normalizeIdentitySourceText(normalizeClinicalText(description));
  const structured = extractStructuredClinicalDescription(descriptionText);
  // RUTs are extracted from combined text — they appear in either field.
  const combinedText = `${summaryText} ${descriptionText}`.trim();
  const ruts = [
    ...new Set(
      Array.from(combinedText.matchAll(new RegExp(RUT_REGEX.source, "g")))
        .map((match) => {
          const rawValue = match[0];
          const index = match.index ?? 0;
          if (!rawValue || !isAcceptedRutCandidate(rawValue, index, combinedText)) return null;
          return normalizeRut(rawValue);
        })
        .filter((rut): rut is string => rut !== null)
    ),
  ];

  // Names: summary always has priority over description.
  // Running extractors separately prevents description noise (clinical notes,
  // field labels like "-Rut del paciente:", previous visit history) from
  // overriding a clearly-identified name in the event title/summary.
  const summaryNames = extractNamesFromText(stripStructuredNoiseForNames(summaryText.trim()));
  const descriptionWithoutBoleta = structured.boletaBlock
    ? descriptionText.replace(structured.boletaBlock, " ")
    : descriptionText;
  const descriptionNames = extractNamesFromText(
    stripStructuredNoiseForNames(descriptionWithoutBoleta)
  );
  const beneficiaryNames = structured.beneficiaryCandidates
    .map((candidate) => candidate.name)
    .filter((value): value is string => value !== null && isLikelyPersonName(value));

  const uniquePatientNames = [...new Set([...summaryNames, ...descriptionNames])].filter((value) =>
    isLikelyPersonName(value)
  );
  const patientRut =
    structured.patientRut ??
    ruts.find((value) => !structured.beneficiaryRuts.includes(value)) ??
    ruts[0] ??
    null;
  const beneficiaryRut =
    structured.beneficiaryRuts.find((value) => value !== patientRut) ??
    ruts.find((value) => value !== patientRut) ??
    null;
  const hasExplicitBeneficiary =
    structured.beneficiaryCandidates.length > 0 || beneficiaryRut != null;
  const patientName = uniquePatientNames[0] ?? null;
  const beneficiaryName = hasExplicitBeneficiary
    ? (beneficiaryNames.find((value) => value !== patientName) ?? null)
    : null;

  return { beneficiaryName, beneficiaryRut, patientName, patientRut };
}

export function resolveClinicalIdentity(
  summary: null | string,
  description: null | string,
  stored?: StoredClinicalIdentity
): ClinicalIdentity {
  const inferred = extractIdentityHints(summary, description);
  if (hasIdentitySourceText(summary, description)) {
    return {
      beneficiaryName: inferred.beneficiaryName,
      beneficiaryRut: sanitizeRut(inferred.beneficiaryRut),
      patientName: inferred.patientName,
      patientRut: sanitizeRut(inferred.patientRut),
    };
  }

  return {
    beneficiaryName:
      inferred.beneficiaryName ??
      (stored?.beneficiaryName && isLikelyPersonName(stored.beneficiaryName)
        ? stored.beneficiaryName
        : null),
    beneficiaryRut: sanitizeRut(inferred.beneficiaryRut ?? stored?.beneficiaryRut ?? null),
    patientName: inferred.patientName ?? stored?.patientName ?? null,
    patientRut: sanitizeRut(inferred.patientRut ?? stored?.patientRut ?? null),
  };
}

export function extractPatientHints(
  summary: null | string,
  description: null | string
): { patientName: null | string; patientRut: null | string } {
  const identity = extractIdentityHints(summary, description);
  return {
    patientName: identity.patientName,
    patientRut: identity.patientRut,
  };
}
