import { normalizeRut } from "../../../lib/rut.ts";

import { RUT_REGEX } from "../constants.ts";
import { isLikelyPersonName, normalizeName } from "../normalization/names.ts";
import { sanitizeRut } from "../normalization/rut.ts";
import type { StructuredClinicalDescription } from "../types.ts";

import { extractNamesFromText } from "./names.ts";

const STRUCTURED_CLINICAL_LABEL_REGEX =
  /(?:^|\n|\s)-?\s*(BOLETAS?\s+a\s+nombre|BOLETA|Rut del paciente|Edad|Comuna|Previsi[oó]n|N[uú]mero de contacto|Correo electr[oó]nico|Motivo de la consulta|Tiempo de evoluci[oó]n|Enfermedades base)\s*:?\s*/gi;
const STRUCTURED_NOISE_LINE_REGEX =
  /(?:^|\n)\s*[-•]?\s*(?:correo(?:\s+electr[oó]nico)?|motivo(?:\s+de\s+la\s+consulta)?|tiempo(?:\s+de\s+evoluci[oó]n)?|tratamiento\s+usado|enfermedades\s+base|n[uú]mero\s+de\s+contacto|n[uú]mero|telefono|tel[eé]fono|edad|comuna|previsi[oó]n|rut\s+del\s+paciente)\s*:\s*[^\n]*/gi;
const EMAIL_REGEX = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const GLUED_RUT_FOLLOWED_BY_AGE_REGEX = /(\d{7,8}-?[\dkK])(?=\d{1,3}\s*a[ñn]os?\b)/gi;
const GLUED_RUT_FOLLOWED_BY_LABEL_REGEX =
  /(\d{7,8}-?[\dkK])(?=-?(?:edad|comuna|previsi[oó]n|n[uú]mero(?:\s+de\s+contacto)?|correo(?:\s+electr[oó]nico)?|motivo(?:\s+de\s+la\s+consulta)?|tiempo(?:\s+de\s+evoluci[oó]n)?|enfermedades\s+base|tratamiento\s+usado)\b)/gi;
const GLUED_TIME_FOLLOWED_BY_NAME_REGEX = /(\b\d{1,2}:\d{2})(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g;

export function cleanStructuredFieldValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[;,]+$/g, "")
    .trim();
}

export function normalizeIdentitySourceText(value: string): string {
  return value
    .replace(GLUED_TIME_FOLLOWED_BY_NAME_REGEX, "$1 ")
    .replace(GLUED_RUT_FOLLOWED_BY_AGE_REGEX, "$1 ")
    .replace(GLUED_RUT_FOLLOWED_BY_LABEL_REGEX, "$1 ");
}

export function stripStructuredNoiseForNames(value: string): string {
  return value
    .replace(STRUCTURED_NOISE_LINE_REGEX, "\n")
    .replace(EMAIL_REGEX, " ")
    .replace(/\b(?:href|mailto|target|blank)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function trimBoletaBlock(value: string): string {
  const normalized = value.trim();
  if (!normalized) return normalized;

  const patientSectionIndex = normalized.search(
    /\n{2,}(?=(?:\+?\d[\d \t-]{6,}\b|\d{1,3}\s*a[ñn]os?\b|\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b))/i
  );
  if (patientSectionIndex >= 0) {
    return normalized.slice(0, patientSectionIndex).trim();
  }

  return normalized;
}

export function extractStructuredClinicalDescription(text: string): StructuredClinicalDescription {
  const empty: StructuredClinicalDescription = {
    beneficiaryCandidates: [],
    beneficiaryRuts: [],
    boletaBlock: null,
    commune: null,
    contactPhone: null,
    consultationReason: null,
    diseases: null,
    email: null,
    evolution: null,
    healthInsurance: null,
    patientRut: null,
  };
  if (!text.trim()) return empty;

  const sections: Array<{ key: string; matchIndex: number; valueStart: number }> = [];
  let match: null | RegExpExecArray;
  STRUCTURED_CLINICAL_LABEL_REGEX.lastIndex = 0;

  while ((match = STRUCTURED_CLINICAL_LABEL_REGEX.exec(text)) !== null) {
    const rawLabel = normalizeName(match[1] ?? "");
    const key =
      rawLabel === "boleta" || rawLabel === "boletas a nombre"
        ? "boleta"
        : rawLabel === "rut del paciente"
          ? "patientRut"
          : rawLabel === "comuna"
            ? "commune"
            : rawLabel === "prevision"
              ? "healthInsurance"
              : rawLabel === "numero de contacto"
                ? "contactPhone"
                : rawLabel === "correo electronico"
                  ? "email"
                  : rawLabel === "motivo de la consulta"
                    ? "consultationReason"
                    : rawLabel === "tiempo de evolucion"
                      ? "evolution"
                      : rawLabel === "enfermedades base"
                        ? "diseases"
                        : null;
    if (!key) continue;
    sections.push({
      key,
      matchIndex: match.index,
      valueStart: match.index + match[0].length,
    });
  }

  if (sections.length === 0) return empty;

  const values = new Map<string, string>();
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const end = sections[index + 1]?.matchIndex ?? text.length;
    const rawValue = text.slice(section.valueStart, end).trim();
    const value = section.key === "boleta" ? rawValue : cleanStructuredFieldValue(rawValue);
    if (value) values.set(section.key, value);
  }

  const boletaValue = values.get("boleta");
  const boletaBlock = boletaValue ? trimBoletaBlock(boletaValue) : null;
  const beneficiaryCandidates: Array<{ name: null | string; rut: string }> = [];
  if (boletaBlock) {
    const boletaRutRegex = new RegExp(RUT_REGEX.source, "g");
    let boletaMatch: null | RegExpExecArray;
    while ((boletaMatch = boletaRutRegex.exec(boletaBlock)) !== null) {
      const rut = sanitizeRut(normalizeRut(boletaMatch[0]));
      if (!rut) continue;
      const lineStart = boletaBlock.lastIndexOf("\n", boletaMatch.index) + 1;
      let lineBeforeRut = cleanStructuredFieldValue(
        boletaBlock.slice(lineStart, boletaMatch.index).replace(/^boleta\s*:\s*/i, "")
      );
      if (!lineBeforeRut) {
        const beforeRutText = boletaBlock
          .slice(0, lineStart)
          .replace(/^boleta\s*:\s*/i, "")
          .trimEnd();
        const previousLine = beforeRutText
          .split("\n")
          .map((line) => cleanStructuredFieldValue(line))
          .filter(Boolean)
          .at(-1);
        lineBeforeRut = previousLine ?? "";
      }
      const extractedName =
        extractNamesFromText(lineBeforeRut)[0] ?? (normalizeName(lineBeforeRut) || null);
      const name = extractedName && isLikelyPersonName(extractedName) ? extractedName : null;
      if (!beneficiaryCandidates.some((candidate) => candidate.rut === rut)) {
        beneficiaryCandidates.push({ name, rut });
      }
    }
  }

  return {
    beneficiaryCandidates,
    beneficiaryRuts: beneficiaryCandidates.map((candidate) => candidate.rut),
    boletaBlock,
    commune: values.get("commune") ?? null,
    contactPhone: values.get("contactPhone") ?? null,
    consultationReason: values.get("consultationReason") ?? null,
    diseases: values.get("diseases") ?? null,
    email: values.get("email") ?? null,
    evolution: values.get("evolution") ?? null,
    healthInsurance: values.get("healthInsurance") ?? null,
    patientRut: sanitizeRut(normalizeRut(values.get("patientRut") ?? null)),
  };
}
