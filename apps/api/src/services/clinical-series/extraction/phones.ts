import { normalizeClinicalText } from "../../../lib/clinical-text.ts";

import {
  extractPhoneCandidates,
  normalizeExtractedPhone,
  normalizeStoredPhoneArray,
} from "../normalization/phones.ts";

import {
  extractStructuredClinicalDescription,
  normalizeIdentitySourceText,
} from "./structured.ts";

export function extractSeriesPhones(
  summary: null | string,
  description: null | string
): { beneficiaryPhones: string[]; patientPhones: string[] } {
  const summaryText = normalizeIdentitySourceText(normalizeClinicalText(summary));
  const descriptionText = normalizeIdentitySourceText(normalizeClinicalText(description));
  const structured = extractStructuredClinicalDescription(descriptionText);

  const patientPhones = new Set<string>();
  const beneficiaryPhones = new Set<string>();

  const pushPhones = (target: Set<string>, values: string[]) => {
    for (const value of values) target.add(value);
  };

  if (structured.contactPhone) {
    const normalized = normalizeExtractedPhone(structured.contactPhone);
    if (normalized) patientPhones.add(normalized);
  }

  const descriptionWithoutBoleta = structured.boletaBlock
    ? descriptionText.replace(structured.boletaBlock, " ")
    : descriptionText;

  pushPhones(patientPhones, extractPhoneCandidates(summaryText));
  pushPhones(patientPhones, extractPhoneCandidates(descriptionWithoutBoleta));
  pushPhones(beneficiaryPhones, extractPhoneCandidates(structured.boletaBlock));

  for (const value of beneficiaryPhones) {
    patientPhones.delete(value);
  }

  return {
    beneficiaryPhones: [...beneficiaryPhones],
    patientPhones: [...patientPhones],
  };
}

export function getSeriesPatientPhones(row: {
  events?: Array<{ description: null | string; summary: null | string }>;
  patientPhones: unknown;
}): string[] {
  const stored = normalizeStoredPhoneArray(row.patientPhones);
  if (stored.length > 0) return stored;
  if (!row.events?.length) return [];

  const derived = new Set<string>();
  for (const event of row.events) {
    const extracted = extractSeriesPhones(event.summary ?? null, event.description ?? null);
    for (const phone of extracted.patientPhones) derived.add(phone);
  }
  return [...derived];
}
