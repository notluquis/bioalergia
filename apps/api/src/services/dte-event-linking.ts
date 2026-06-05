import { db } from "@finanzas/db";
import jaroWinkler from "talisman/metrics/jaro-winkler.js";
import { symmetric as mongeElkanSymmetric } from "talisman/metrics/monge-elkan.js";
import { joinClinicalText } from "../lib/clinical-text.ts";
import { normalizeRut } from "../lib/rut.ts";
import { getMonthRange, toChileDateString } from "../lib/time.ts";
import {
  type ClinicalSeriesSnapshot,
  extractIdentityHints,
  getClinicalSeriesSnapshotByExternalEvent,
  syncClinicalSeriesForInternalEventId,
} from "./clinical-series.ts";

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const TIMEZONE = "America/Santiago";
const RUT_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const CAPITALIZED_NAME_REGEX = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})/g;
const DEFAULT_REEMBOLSO_MULTI_DATE_WINDOW_DAYS = 120;
const MAX_REEMBOLSO_MULTI_DATE_WINDOW_DAYS = 365;
const REEMBOLSO_VENDOR_REGEX = /\b(?:roxair|bactek(?:-r)?)\b/;
const REEMBOLSO_ACTION_REGEX = /\b(?:retiro|retira)\b/;
const REEMBOLSO_CATEGORY_TOKEN = "reembolso";

function parseBooleanEnv(value: undefined | string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on", "si", "sí"].includes(normalized);
}

function parsePositiveIntegerEnv(value: undefined | string, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_REEMBOLSO_MULTI_DATE_WINDOW_DAYS);
}

const REEMBOLSO_MULTI_DATE_BUNDLE_ENABLED = parseBooleanEnv(
  process.env.DTE_REEMBOLSO_MULTI_DATE_BUNDLE_ENABLED
);
const REEMBOLSO_MULTI_DATE_WINDOW_DAYS = parsePositiveIntegerEnv(
  process.env.DTE_REEMBOLSO_MULTI_DATE_WINDOW_DAYS,
  DEFAULT_REEMBOLSO_MULTI_DATE_WINDOW_DAYS
);

const EVENT_NOISE_TOKENS = new Set([
  "acaros",
  "ampolla",
  "confirma",
  "confirmar",
  "control",
  "dosis",
  "entrega",
  "inyeccion",
  "instalacion",
  "lectura",
  "llego",
  "llevo",
  "mantencion",
  "mensual",
  "ml",
  "pagada",
  "pagado",
  "parche",
  "retiro",
  "se",
  "semanal",
  "servicio",
  "subcutaneo",
  "test",
  "tratamiento",
  "vac",
  "vacuna",
]);

const MIN_AUTO_LINK_SCORE = 90;
const MAX_AUTO_LINK_AMOUNT_DIFF = 5000;
const MIN_REVIEW_SCORE = 35;

type MatchMethod = "mixed" | "name_exact" | "name_fuzzy" | "rut";
type AutoLinkStrategy = "missing_only" | "relink_all";
type HypothesisKind = "bundle" | "single";
type PolicyKey =
  | "default_same_day"
  | "same_day_unlinked_fallback"
  | "skin_test_bundle"
  | "reembolso_bundle";
type FeedbackAction = "confirmed" | "manual_override" | "rejected" | "unlinked";
const CROSS_SERIES_WARNING_PREFIX = "Advertencia:";

interface SkipReasonCount {
  count: number;
  reason: string;
}

interface AutoLinkPeriodSummary {
  daysProcessed: number;
  linked: number;
  period: string;
  skipped: number;
  totalEvents: number;
}

interface AutoLinkProgressSnapshot {
  completedPeriods: number;
  currentPeriod: string;
  linked: number;
  skipped: number;
  totalEvents: number;
  totalPeriods: number;
}

export interface MatchSignal {
  code: string;
  label: string;
  value?: null | string;
  weight: number;
}

export interface EventIdentityClaims {
  amountHint: null | number;
  beneficiaryName: null | string;
  beneficiaryRut: null | string;
  eventDate: string;
  nameClaims: string[];
  patientName: null | string;
  patientRut: null | string;
  rutClaims: string[];
  sameDayOnly: boolean;
  seriesLinkedRuts: string[];
  seriesKind: null | "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT" | "MEDICAL_CONSULTATION";
}

export interface CandidateSetSummary {
  consideredCount: number;
  fallbackCount: number;
  retrievedCount: number;
  sameDayCount: number;
}

export interface EventDteSuggestion {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  documentType: number;
  dteSaleDetailId: string;
  exemptAmount: number;
  folio: string;
  ivaAmount: number;
  linkedEventsCount: number;
  method: MatchMethod;
  netAmount: number;
  reasons: string[];
  totalAmount: number;
}

export interface MatchHypothesis {
  amountDiff: null | number;
  autoLinkEligible: boolean;
  clientName: string;
  clientRUT: string;
  crossSeriesConflicts: CrossSeriesConflict[];
  documentDate: string;
  documents: EventDteSuggestion[];
  dteSaleDetailIds: string[];
  folios: string[];
  hypothesisId: string;
  kind: HypothesisKind;
  method: MatchMethod;
  policyKey: PolicyKey;
  reasons: string[];
  score: number;
  signals: MatchSignal[];
  totalAmount: number;
}

export interface EventDteBundleSuggestion {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  count: number;
  documentDate: string;
  documents: EventDteSuggestion[];
  dteSaleDetailIds: string[];
  folios: string[];
  method: MatchMethod;
  reasons: string[];
  totalAmount: number;
}

export interface EventDteLinkRecord {
  confidenceScore: number;
  createdAt: string;
  createdBy: null | number;
  dte: {
    clientName: string;
    clientRUT: string;
    documentDate: string;
    documentType: number;
    folio: string;
    totalAmount: number;
  };
  dteSaleDetailId: string;
  evidence: unknown;
  eventId: number;
  id: number;
  matchedBy: string;
  matchedName: null | string;
  matchedRUT: null | string;
  status: "CONFIRMED" | "MANUAL" | "REJECTED";
  updatedAt: string;
}

interface EventDteLinkedDocument {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  documentDate: string;
  dteSaleDetailId: string;
  folio: string;
  matchedBy: string;
  totalAmount: number;
}

interface SameKindRutConflictRow {
  beneficiaryRut: null | string;
  clientRUT: string;
  patientName: null | string;
  patientRut: null | string;
  seriesId: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
}

export interface CrossSeriesConflict {
  patientName: null | string;
  patientRut: null | string;
  seriesId: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
}

type CrossSeriesConflictInfo = { conflicts: CrossSeriesConflict[]; message: string };

interface EventRow {
  amountExpected: null | number;
  amountPaid: null | number;
  category: null | string;
  clinicalSeriesId: null | number;
  description: null | string;
  eventDate: string;
  eventId: number;
  externalEventId: string;
  googleCalendarId: string;
  linkedCount: number;
  linkedDteSaleDetailId: null | string;
  summary: null | string;
}

interface DteSaleRow {
  clientName: string;
  clientRUT: string;
  documentDate: string;
  documentType: number;
  dteSaleDetailId: string;
  exemptAmount: number;
  folio: string;
  ivaAmount: number;
  linkedEventsCount: number;
  netAmount: number;
  retrievalMeta: {
    amountCandidate: boolean;
    exactRutMatch: boolean;
    sameSeriesRutMatch: boolean;
    sharedSurnameMatch: boolean;
    trigramSimilarity: number;
  };
  totalAmount: number;
}

interface CandidateAnalysis {
  amountDiff: null | number;
  candidate: DteSaleRow;
  crossSeriesConflicts: CrossSeriesConflict[];
  document: EventDteSuggestion;
  exactRutMatch: boolean;
  fuzzyNameScore: number;
  exactNameMatch: boolean;
  method: MatchMethod;
  reasons: string[];
  score: number;
  sharedSurnameToken: null | string;
  signals: MatchSignal[];
}

interface EventDteOverviewRow {
  amountExpected: null | number;
  amountPaid: null | number;
  calendarId: string;
  clinicalSeriesId: null | number;
  confidenceScore: null | number;
  displayName: null | string;
  eventDate: string;
  eventTime: null | string;
  eventId: string;
  lastAutoLinkSkipAt: Date | null;
  lastAutoLinkSkipReason: null | string;
  linkedCount: number;
  linkedClientName: null | string;
  linkedClientRUT: null | string;
  linkedDocumentsJson: unknown;
  linkedDteSaleDetailId: null | string;
  linkedFolio: null | string;
  linkedMatchedBy: null | string;
  linkedTotalAmount: null | number;
  seriesKind: null | "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT" | "MEDICAL_CONSULTATION";
  summary: null | string;
}

function incrementReason(counter: Map<string, number>, reason: string, increment = 1) {
  counter.set(reason, (counter.get(reason) ?? 0) + increment);
}

function normalizeReasonCounts(counter: Map<string, number>): SkipReasonCount[] {
  return [...counter.entries()]
    .map(([reason, count]) => ({ count, reason }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function parseLinkedDocumentsJson(value: unknown): EventDteLinkedDocument[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const clientName = typeof record.clientName === "string" ? record.clientName : null;
    const clientRUT = typeof record.clientRUT === "string" ? record.clientRUT : null;
    const dteSaleDetailId =
      typeof record.dteSaleDetailId === "string" ? record.dteSaleDetailId : null;
    const folio = typeof record.folio === "string" ? record.folio : null;
    const matchedBy = typeof record.matchedBy === "string" ? record.matchedBy : null;
    const confidenceScore =
      typeof record.confidenceScore === "number" ? record.confidenceScore : null;
    const totalAmount = typeof record.totalAmount === "number" ? record.totalAmount : null;
    const documentDate = typeof record.documentDate === "string" ? record.documentDate : "";

    if (
      !clientName ||
      !clientRUT ||
      !dteSaleDetailId ||
      !folio ||
      !matchedBy ||
      confidenceScore == null ||
      totalAmount == null
    ) {
      return [];
    }

    return [
      {
        clientName,
        clientRUT,
        confidenceScore,
        documentDate,
        dteSaleDetailId,
        folio,
        matchedBy,
        totalAmount,
      },
    ];
  });
}

async function recordAutoLinkAttempt(params: {
  confidenceScore?: number;
  dteSaleDetailId?: null | string;
  eventId: number;
  reason: string;
  status: "LINKED" | "SKIPPED";
  userId: number;
}) {
  const normalizedScore =
    params.confidenceScore != null && Number.isFinite(params.confidenceScore)
      ? Math.max(0, Math.min(100, params.confidenceScore))
      : null;

  await db.$executeRaw`
    INSERT INTO event_dte_auto_link_attempts (
      event_id,
      candidate_dte_sale_detail_id,
      status,
      reason,
      confidence_score,
      created_by,
      created_at
    ) VALUES (
      ${params.eventId},
      ${params.dteSaleDetailId ?? null},
      ${params.status},
      ${params.reason},
      ${normalizedScore},
      ${params.userId},
      NOW()
    )
  `;
}

async function recordMatchReview(params: {
  action: FeedbackAction;
  createdBy?: null | number;
  dteSaleDetailIds: string[];
  eventId: number;
  hypothesis?: unknown;
  hypothesisKind?: null | HypothesisKind;
}) {
  await db.$executeRaw`
    INSERT INTO event_dte_match_reviews (
      event_id,
      action,
      hypothesis_kind,
      dte_sale_detail_ids,
      hypothesis,
      created_by,
      created_at
    ) VALUES (
      ${params.eventId},
      ${params.action},
      ${params.hypothesisKind ?? null},
      ${JSON.stringify(params.dteSaleDetailIds)}::jsonb,
      ${params.hypothesis ? JSON.stringify(params.hypothesis) : null}::jsonb,
      ${params.createdBy ?? null},
      NOW()
    )
  `;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string): string {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !EVENT_NOISE_TOKENS.has(token))
    .join(" ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function bigrams(value: string): string[] {
  const cleaned = normalizeName(value).replace(/\s+/g, " ");
  if (cleaned.length < 2) return cleaned ? [cleaned] : [];
  const result: string[] = [];
  for (let i = 0; i < cleaned.length - 1; i += 1) {
    result.push(cleaned.slice(i, i + 2));
  }
  return result;
}

function diceCoefficient(a: string, b: string): number {
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  if (aPairs.length === 0 || bPairs.length === 0) return 0;

  const aMap = new Map<string, number>();
  for (const pair of aPairs) {
    aMap.set(pair, (aMap.get(pair) ?? 0) + 1);
  }

  let overlap = 0;
  for (const pair of bPairs) {
    const count = aMap.get(pair) ?? 0;
    if (count > 0) {
      overlap += 1;
      aMap.set(pair, count - 1);
    }
  }

  return (2 * overlap) / (aPairs.length + bPairs.length);
}

function tokenSetF1(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }

  if (intersection === 0) return 0;
  const precision = intersection / aTokens.size;
  const recall = intersection / bTokens.size;
  return (2 * precision * recall) / (precision + recall);
}

// Sort tokens alphabetically so "YAÑEZ ROJAS NADIA" and "nadia yanez rojas"
// produce the same canonical form after normalization. This handles the SII
// convention of storing names as APELLIDO_PATERNO APELLIDO_MATERNO NOMBRES.
function tokenSort(value: string): string {
  return normalizeName(value).split(" ").sort().join(" ");
}

// Symmetric Monge-Elkan with Jaro-Winkler as the inner metric.
// Applies JW to every (source-token, target-token) pair and takes the max per
// source token, then averages. Symmetric variant averages both directions so
// neither side is penalised for having extra tokens (e.g. middle names).
// This is the algorithm used by Splink (UK MoJ record-linkage) for name fields.
function mongeElkanScore(a: string, b: string): number {
  const aTokens = tokenize(tokenSort(a));
  const bTokens = tokenize(tokenSort(b));
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  return mongeElkanSymmetric(jaroWinkler, aTokens, bTokens);
}

function containsName(hint: string, candidateName: string): boolean {
  const normalizedHint = normalizeName(hint);
  const normalizedCandidate = normalizeName(candidateName);
  if (!normalizedHint || !normalizedCandidate) return false;
  // Direct substring check (original)
  if (
    normalizedHint.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedHint)
  ) {
    return true;
  }
  // Token-sorted comparison: catches SII reversed format
  const sortedHint = tokenSort(normalizedHint);
  const sortedCandidate = tokenSort(normalizedCandidate);
  return (
    sortedHint === sortedCandidate ||
    sortedHint.includes(sortedCandidate) ||
    sortedCandidate.includes(sortedHint)
  );
}

function surnameTokens(value: string): string[] {
  // Filter name particles (de, del, la, los, von, van) which are not surnames.
  const PARTICLES = new Set(["de", "del", "la", "los", "las", "von", "van", "y"]);
  const tokens = tokenize(value).filter((t) => t.length >= 3 && !PARTICLES.has(t));
  return tokens.slice(-2);
}

function findSharedSurnameToken(nameClaims: string[], candidateName: string): null | string {
  const candidateSurnames = new Set(surnameTokens(candidateName));
  if (candidateSurnames.size === 0) return null;

  for (const hint of nameClaims) {
    for (const token of surnameTokens(hint)) {
      if (candidateSurnames.has(token)) return token;
    }
  }

  return null;
}

function extractRutHints(text: string): string[] {
  const matches = text.match(RUT_REGEX) ?? [];
  const normalized = matches
    .map((value) => normalizeRut(value) || value.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function extractNameHints(text: string): string[] {
  const raw = Array.from(text.matchAll(CAPITALIZED_NAME_REGEX), (match) => (match[1] ?? "").trim())
    .filter((value) => value.length >= 7)
    .filter((value) => tokenize(value).length >= 2);

  const normalized = raw
    .map((value) => normalizeName(value))
    .filter((value) => value.length >= 5)
    .filter((value) => tokenize(value).length >= 2);

  return [...new Set(normalized)].slice(0, 8);
}

function computeAmountHint(event: EventRow): null | number {
  if (event.amountPaid != null && Number.isFinite(event.amountPaid))
    return Number(event.amountPaid);
  if (event.amountExpected != null && Number.isFinite(event.amountExpected)) {
    return Number(event.amountExpected);
  }

  const mergedText = joinClinicalText(event.summary, event.description);
  const amountMatches = Array.from(mergedText.matchAll(/\((\d{2,7})\)/g), (match) => match[1]);
  const first = amountMatches[0] ? Number(amountMatches[0]) : Number.NaN;
  return Number.isFinite(first) ? first : null;
}

export function resolveMatchAmountHint(params: {
  event: Pick<EventRow, "amountExpected" | "amountPaid" | "description" | "summary">;
  sameDayOnly: boolean;
  series: ClinicalSeriesSnapshot | null;
}): null | number {
  const eventAmountHint = computeAmountHint(params.event as EventRow);

  // Same-day matching is event-scoped: the right target is the amount of the
  // concrete session being linked, not the remaining balance of the whole
  // clinical series. Using series.remaining* here makes single-session vaccine
  // events look wildly out of range and blocks otherwise exact matches.
  if (params.sameDayOnly) {
    return eventAmountHint;
  }

  if (eventAmountHint != null) {
    return eventAmountHint;
  }

  if (params.series) {
    if (params.series.remainingPaid > 0) return params.series.remainingPaid;
    if (params.series.remainingExpected > 0) return params.series.remainingExpected;
  }

  return null;
}

function toSignal(code: string, label: string, weight: number, value?: null | string): MatchSignal {
  return { code, label, value, weight };
}

function extractIdentityClaims(params: {
  event: EventRow;
  sameDayOnly: boolean;
  series: ClinicalSeriesSnapshot | null;
}): EventIdentityClaims {
  const mergedText = joinClinicalText(params.event.summary, params.event.description);
  const identityHints = extractIdentityHints(params.event.summary, params.event.description);
  const rutClaims = [
    ...new Set(
      [
        ...extractRutHints(mergedText),
        identityHints.patientRut,
        identityHints.beneficiaryRut,
        params.series?.patientRut ?? null,
        params.series?.beneficiaryRut ?? null,
      ].filter((value): value is string => Boolean(value))
    ),
  ];
  const nameClaims = [
    ...new Set(
      [
        ...extractNameHints(mergedText),
        identityHints.patientName,
        identityHints.beneficiaryName,
        params.series?.patientName ?? null,
        params.series?.beneficiaryName ?? null,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeName(value))
        .filter((value) => tokenize(value).length >= 2)
    ),
  ];

  const seriesLinkedRuts = [
    ...new Set(
      (params.series?.linkedDocuments ?? [])
        .map((document) => normalizeRut(document.clientRUT) || document.clientRUT)
        .filter(Boolean)
    ),
  ];

  return {
    amountHint: resolveMatchAmountHint({
      event: params.event,
      sameDayOnly: params.sameDayOnly,
      series: params.series,
    }),
    beneficiaryName: identityHints.beneficiaryName ?? params.series?.beneficiaryName ?? null,
    beneficiaryRut: identityHints.beneficiaryRut ?? params.series?.beneficiaryRut ?? null,
    eventDate: params.event.eventDate,
    nameClaims,
    patientName: identityHints.patientName ?? params.series?.patientName ?? null,
    patientRut: identityHints.patientRut ?? params.series?.patientRut ?? null,
    rutClaims,
    sameDayOnly: params.sameDayOnly,
    seriesLinkedRuts,
    seriesKind: params.series?.kind ?? null,
  };
}

export function isReembolsoBundleEvent(
  event: Pick<EventRow, "category" | "description" | "summary">
) {
  const category = normalizeText(event.category ?? "");
  const text = normalizeText(joinClinicalText(event.summary, event.description));

  const hasVendor = REEMBOLSO_VENDOR_REGEX.test(category) || REEMBOLSO_VENDOR_REGEX.test(text);
  if (!hasVendor) return false;

  const hasReembolsoCategory = category.includes(REEMBOLSO_CATEGORY_TOKEN);
  const hasRetiroAction = REEMBOLSO_ACTION_REGEX.test(text);
  const isRoxairCategory = category === "roxair";

  return hasReembolsoCategory || hasRetiroAction || isRoxairCategory;
}

export function resolveSuggestionDateWindow(params: {
  event: Pick<EventRow, "category" | "description" | "eventDate" | "summary">;
  sameDayOnly: boolean;
  series: ClinicalSeriesSnapshot | null;
  reembolsoMultiDateBundleEnabled?: boolean;
  reembolsoMultiDateWindowDays?: number;
}): { from: string; mode: "reembolso_multi_date" | "same_day" | "series_window"; to: string } {
  const reembolsoMultiDateBundleEnabled =
    params.reembolsoMultiDateBundleEnabled ?? REEMBOLSO_MULTI_DATE_BUNDLE_ENABLED;
  const requestedWindowDays =
    params.reembolsoMultiDateWindowDays ?? REEMBOLSO_MULTI_DATE_WINDOW_DAYS;
  const reembolsoMultiDateWindowDays = Math.max(
    1,
    Math.min(requestedWindowDays, MAX_REEMBOLSO_MULTI_DATE_WINDOW_DAYS)
  );

  const enableReembolsoMultiDate =
    params.sameDayOnly && reembolsoMultiDateBundleEnabled && isReembolsoBundleEvent(params.event);

  if (enableReembolsoMultiDate) {
    const base = Temporal.PlainDate.from(params.event.eventDate.slice(0, 10));
    return {
      from: base.subtract({ days: reembolsoMultiDateWindowDays }).toString(),
      mode: "reembolso_multi_date",
      to: base.add({ days: reembolsoMultiDateWindowDays }).toString(),
    };
  }

  if (params.sameDayOnly) {
    return {
      from: params.event.eventDate,
      mode: "same_day",
      to: params.event.eventDate,
    };
  }

  return {
    from: params.series?.eligibleDocumentDateFrom ?? params.event.eventDate,
    mode: "series_window",
    to: params.series?.eligibleDocumentDateTo ?? params.event.eventDate,
  };
}

function currencyFormatterForReason(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function clinicalSeriesKindLabel(
  kind: EventIdentityClaims["seriesKind"] | ClinicalSeriesSnapshot["kind"] | null
): string {
  if (kind === "PATCH_TEST") return "test de parche";
  if (kind === "SKIN_TEST") return "test cutáneo";
  if (kind === "SUBCUTANEOUS_TREATMENT") return "tratamiento subcutáneo";
  return "serie clínica";
}

function isSamePatientIdentity(params: {
  currentBeneficiaryRut?: null | string;
  currentPatientName: null | string;
  currentPatientRut: null | string;
  otherBeneficiaryRut?: null | string;
  otherPatientName: null | string;
  otherPatientRut: null | string;
}) {
  const currentRut = params.currentPatientRut ? normalizeRut(params.currentPatientRut) : null;
  const otherRut = params.otherPatientRut ? normalizeRut(params.otherPatientRut) : null;
  const currentBenefRut = params.currentBeneficiaryRut
    ? normalizeRut(params.currentBeneficiaryRut)
    : null;
  const otherBenefRut = params.otherBeneficiaryRut
    ? normalizeRut(params.otherBeneficiaryRut)
    : null;

  if (currentRut && otherRut) {
    if (currentRut === otherRut) return true;
    // Same person, patient/beneficiary RUTs swapped between series
    if (currentBenefRut && currentBenefRut === otherRut) return true;
    if (otherBenefRut && otherBenefRut === currentRut) return true;
  }

  const currentName = params.currentPatientName ? normalizeName(params.currentPatientName) : "";
  const otherName = params.otherPatientName ? normalizeName(params.otherPatientName) : "";
  if (currentName && otherName) return currentName === otherName;

  return false;
}

async function getSameKindRutConflictWarnings(params: {
  candidateRuts: string[];
  currentBeneficiaryRut: null | string;
  currentPatientName: null | string;
  currentPatientRut: null | string;
  seriesId: number;
  seriesKind: ClinicalSeriesSnapshot["kind"];
}) {
  const normalizedCandidateRuts = [
    ...new Set(params.candidateRuts.map((rut) => normalizeRut(rut) || rut).filter(Boolean)),
  ];
  if (normalizedCandidateRuts.length === 0) return new Map<string, CrossSeriesConflictInfo>();

  const rows = await db.$queryRaw<SameKindRutConflictRow[]>`
    SELECT DISTINCT ON (s.client_rut, cs.id)
      s.client_rut AS "clientRUT",
      cs.id AS "seriesId",
      cs.patient_name AS "patientName",
      cs.patient_rut AS "patientRut",
      cs.beneficiary_rut AS "beneficiaryRut",
      cs.status::text AS "status"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN clinical_series cs ON cs.id = e.clinical_series_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE cs.id <> ${params.seriesId}
      AND cs.kind = ${params.seriesKind}
      AND s.client_rut = ANY(${normalizedCandidateRuts}::text[])
    ORDER BY s.client_rut, cs.id, l.updated_at DESC
  `;

  const byRut = new Map<string, SameKindRutConflictRow[]>();
  for (const row of rows) {
    const normalizedRut = normalizeRut(row.clientRUT) || row.clientRUT;
    if (
      isSamePatientIdentity({
        currentBeneficiaryRut: params.currentBeneficiaryRut,
        currentPatientName: params.currentPatientName,
        currentPatientRut: params.currentPatientRut,
        otherBeneficiaryRut: row.beneficiaryRut,
        otherPatientName: row.patientName,
        otherPatientRut: row.patientRut,
      })
    ) {
      continue;
    }

    const current = byRut.get(normalizedRut) ?? [];
    current.push(row);
    byRut.set(normalizedRut, current);
  }

  const warnings = new Map<string, CrossSeriesConflictInfo>();
  for (const [rut, conflicts] of byRut) {
    if (conflicts.length === 0) continue;
    const examples = conflicts
      .slice(0, 2)
      .map(
        (conflict) => conflict.patientName ?? conflict.patientRut ?? `Serie #${conflict.seriesId}`
      );
    const countLabel = conflicts.length === 1 ? "otra serie" : `${conflicts.length} otras series`;
    const examplesLabel = examples.length > 0 ? ` Ejemplos: ${examples.join(" · ")}.` : "";
    warnings.set(rut, {
      conflicts: conflicts.map((c) => ({
        patientName: c.patientName,
        patientRut: c.patientRut,
        seriesId: c.seriesId,
        status: c.status,
      })),
      message: `${CROSS_SERIES_WARNING_PREFIX} este RUT ya aparece vinculado en ${countLabel} de ${clinicalSeriesKindLabel(params.seriesKind)} con otro paciente.${examplesLabel}`,
    });
  }

  return warnings;
}

function isHypothesisAmbiguous(top: MatchHypothesis, second: MatchHypothesis | undefined): boolean {
  if (!second) return false;
  const topExactRut = top.signals.some((signal) => signal.code === "exact_rut");
  if (topExactRut) return false;
  return top.score >= 70 && second.score >= 70 && top.score - second.score <= 7;
}

export function scoreCandidate(params: {
  amountHint: null | number;
  dte: Omit<DteSaleRow, "retrievalMeta"> & { retrievalMeta?: DteSaleRow["retrievalMeta"] };
  nameHints: string[];
  rutHints: string[];
  seriesLinkedRuts?: string[];
}): EventDteSuggestion {
  return analyzeCandidate({
    amountHint: params.amountHint,
    candidate: {
      ...params.dte,
      retrievalMeta: params.dte.retrievalMeta ?? {
        amountCandidate: false,
        exactRutMatch: false,
        sameSeriesRutMatch: false,
        sharedSurnameMatch: false,
        trigramSimilarity: 0,
      },
    },
    nameClaims: params.nameHints,
    rutClaims: params.rutHints,
    seriesLinkedRuts: params.seriesLinkedRuts ?? [],
  }).document;
}

function analyzeCandidate(params: {
  amountHint: null | number;
  candidate: DteSaleRow;
  crossSeriesWarningByRut?: Map<string, CrossSeriesConflictInfo>;
  nameClaims: string[];
  rutClaims: string[];
  seriesLinkedRuts: string[];
}): CandidateAnalysis {
  const candidateRut = normalizeRut(params.candidate.clientRUT) || params.candidate.clientRUT;
  const rutMatch = params.rutClaims.some((rut) => rut === candidateRut);
  const sameSeriesRutMatch =
    !rutMatch && params.seriesLinkedRuts.some((rut) => rut === candidateRut);

  let bestNameScore = 0;
  let exactNameMatch = false;
  for (const nameClaim of params.nameClaims) {
    const tokenScore = tokenSetF1(nameClaim, params.candidate.clientName);
    const diceScore = diceCoefficient(nameClaim, params.candidate.clientName);
    // Monge-Elkan with Jaro-Winkler handles partial names and SII reversed
    // format (APELLIDO APELLIDO NOMBRE) better than bigram/token-F1 alone.
    // Only use meScore when it's strong enough to reflect a real partial-name
    // match (≥0.70). A single shared surname token produces ~0.65 which would
    // inflate the score for unrelated people (e.g. guardian/patient sharing a
    // surname). Most genuine partial matches where 2+ tokens align score ≥0.70.
    const meScore = mongeElkanScore(nameClaim, params.candidate.clientName);
    const combined = Math.max(tokenScore, diceScore, meScore >= 0.7 ? meScore : 0);
    if (containsName(nameClaim, params.candidate.clientName)) {
      exactNameMatch = true;
      bestNameScore = Math.max(bestNameScore, 1);
    } else {
      bestNameScore = Math.max(bestNameScore, combined);
    }
  }

  const amountDiff =
    params.amountHint != null ? Math.abs(params.amountHint - params.candidate.totalAmount) : null;

  let score = 0;
  const signals: MatchSignal[] = [];
  const reasons: string[] = [];
  let method: MatchMethod = "name_fuzzy";

  if (rutMatch) {
    score += 95;
    signals.push(toSignal("exact_rut", "RUT exacto", 95));
    reasons.push("RUT exacto encontrado en título/descripción del evento");
    method = params.nameClaims.length > 0 ? "mixed" : "rut";
  }

  if (sameSeriesRutMatch) {
    score += 30;
    signals.push(toSignal("same_series_rut", "Mismo RUT ya vinculado en la serie", 30));
    reasons.push("RUT ya confirmado en otro evento de la misma serie clínica");
  }

  if (exactNameMatch) {
    const weight = rutMatch ? 5 : 88;
    score += weight;
    signals.push(toSignal("exact_name", "Nombre exacto", weight));
    reasons.push("Nombre exacto detectado en título/descripción");
    method = rutMatch ? "mixed" : "name_exact";
  } else if (bestNameScore > 0) {
    const fuzzyContribution = Math.round(bestNameScore * 80);
    score += fuzzyContribution;
    signals.push(
      toSignal(
        "fuzzy_name",
        "Coincidencia difusa de nombre",
        fuzzyContribution,
        `${Math.round(bestNameScore * 100)}%`
      )
    );
    reasons.push(`Coincidencia difusa de nombre: ${Math.round(bestNameScore * 100)}%`);
    if (!rutMatch) method = "name_fuzzy";
  }

  if (amountDiff != null) {
    if (amountDiff <= 500) {
      score += 8;
      signals.push(toSignal("amount_exactish", "Monto coincide casi exacto", 8));
      reasons.push("Monto coincide casi exacto");
    } else if (amountDiff <= 2000) {
      score += 5;
      signals.push(toSignal("amount_near", "Monto cercano", 5));
      reasons.push("Monto cercano");
    } else if (amountDiff <= MAX_AUTO_LINK_AMOUNT_DIFF) {
      score += 3;
      signals.push(toSignal("amount_compatible", "Monto compatible", 3));
      reasons.push("Monto compatible");
    }
  }

  // trigramSimilarity is computed by pg_trgm's word_similarity() in the DB
  // retrieval query and carried in retrievalMeta. Use it as a supplementary
  // signal when name-level scoring hasn't already captured the match and there
  // is no RUT hit — this catches cases where the name claim is a short partial
  // (e.g. "nadia yanez") against a long DTE name ("YAÑEZ ROJAS NADIA VALENTINA").
  const trigramSim = params.candidate.retrievalMeta?.trigramSimilarity ?? 0;
  if (!rutMatch && !exactNameMatch && bestNameScore === 0 && trigramSim >= 0.5) {
    const trigramWeight = Math.round((trigramSim - 0.5) * 30); // 0 at 0.5, max 15 at 1.0
    if (trigramWeight > 0) {
      score += trigramWeight;
      signals.push(
        toSignal(
          "trigram_similarity",
          "Similaridad trigramática (DB)",
          trigramWeight,
          `${Math.round(trigramSim * 100)}%`
        )
      );
      reasons.push(`Similaridad trigramática en DB: ${Math.round(trigramSim * 100)}%`);
    }
  }

  const sharedSurnameToken =
    !rutMatch && !exactNameMatch && params.candidate.linkedEventsCount === 0 && amountDiff != null
      ? findSharedSurnameToken(params.nameClaims, params.candidate.clientName)
      : null;
  if (sharedSurnameToken && amountDiff != null && amountDiff <= 500) {
    score += 30;
    signals.push(
      toSignal(
        "shared_surname_guardian",
        "Apellido compartido con posible responsable/paciente",
        30,
        sharedSurnameToken
      )
    );
    reasons.push(
      `Apellido compartido (${sharedSurnameToken}) con posible responsable/paciente y DTE aún libre`
    );
  }

  if (params.candidate.linkedEventsCount === 0) {
    signals.push(toSignal("document_free", "DTE libre", 0));
  }

  const crossSeriesInfo = params.crossSeriesWarningByRut?.get(candidateRut);
  if (crossSeriesInfo) {
    signals.push(
      toSignal("cross_series_same_rut_warning", "RUT presente en otra serie del mismo tipo", 0)
    );
    reasons.push(crossSeriesInfo.message);
  }

  const confidenceScore = Math.max(0, Math.min(100, score));

  return {
    amountDiff,
    candidate: params.candidate,
    crossSeriesConflicts: crossSeriesInfo?.conflicts ?? [],
    document: {
      clientName: params.candidate.clientName,
      clientRUT: params.candidate.clientRUT,
      confidenceScore,
      documentDate: params.candidate.documentDate,
      documentType: params.candidate.documentType,
      dteSaleDetailId: params.candidate.dteSaleDetailId,
      exemptAmount: params.candidate.exemptAmount,
      folio: params.candidate.folio,
      ivaAmount: params.candidate.ivaAmount,
      linkedEventsCount: params.candidate.linkedEventsCount,
      method,
      netAmount: params.candidate.netAmount,
      reasons,
      totalAmount: params.candidate.totalAmount,
    },
    exactRutMatch: rutMatch,
    fuzzyNameScore: bestNameScore,
    exactNameMatch,
    method,
    reasons,
    score: confidenceScore,
    sharedSurnameToken,
    signals,
  };
}

function buildSingleHypothesis(
  analysis: CandidateAnalysis,
  claims: EventIdentityClaims
): MatchHypothesis {
  const autoLinkEligible =
    analysis.score >= MIN_AUTO_LINK_SCORE &&
    analysis.amountDiff != null &&
    analysis.amountDiff <= MAX_AUTO_LINK_AMOUNT_DIFF &&
    analysis.candidate.linkedEventsCount === 0;

  return {
    amountDiff: analysis.amountDiff,
    autoLinkEligible,
    clientName: analysis.document.clientName,
    clientRUT: analysis.document.clientRUT,
    crossSeriesConflicts: analysis.crossSeriesConflicts,
    documentDate: analysis.document.documentDate,
    documents: [analysis.document],
    dteSaleDetailIds: [analysis.document.dteSaleDetailId],
    folios: [analysis.document.folio],
    hypothesisId: `single:${analysis.document.dteSaleDetailId}`,
    kind: "single",
    method: analysis.method,
    policyKey: "default_same_day",
    reasons: analysis.reasons,
    score: analysis.score,
    signals: [
      ...analysis.signals,
      toSignal("same_day_policy", claims.sameDayOnly ? "Mismo día" : "Ventana serie", 0),
    ],
    totalAmount: analysis.document.totalAmount,
  };
}

function combineMethod(methods: MatchMethod[]): MatchMethod {
  if (methods.includes("mixed")) return "mixed";
  if (methods.includes("name_exact")) return "name_exact";
  if (methods.includes("name_fuzzy")) return "name_fuzzy";
  return "rut";
}

export function findSkinTestBundleSuggestions(params: {
  amountHint: null | number;
  candidates: Array<
    Omit<DteSaleRow, "retrievalMeta"> & { retrievalMeta?: DteSaleRow["retrievalMeta"] }
  >;
  limit?: number;
  nameHints: string[];
  rutHints: string[];
}): EventDteBundleSuggestion[] {
  const analyses = params.candidates.map((candidate) =>
    analyzeCandidate({
      amountHint: params.amountHint,
      candidate: {
        ...candidate,
        retrievalMeta: candidate.retrievalMeta ?? {
          amountCandidate: false,
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
      nameClaims: params.nameHints,
      rutClaims: params.rutHints,
      seriesLinkedRuts: [],
    })
  );

  return buildBundleHypotheses({
    amountHint: params.amountHint,
    analyses,
    enabled: true,
    limit: params.limit ?? 5,
    policyKey: "skin_test_bundle",
  }).map((hypothesis) => ({
    clientName: hypothesis.clientName,
    clientRUT: hypothesis.clientRUT,
    confidenceScore: hypothesis.score,
    count: hypothesis.dteSaleDetailIds.length,
    documentDate: hypothesis.documentDate,
    documents: hypothesis.documents,
    dteSaleDetailIds: hypothesis.dteSaleDetailIds,
    folios: hypothesis.folios,
    method: hypothesis.method,
    reasons: hypothesis.reasons,
    totalAmount: hypothesis.totalAmount,
  }));
}

function buildBundleHypotheses(params: {
  amountHint: null | number;
  analyses: CandidateAnalysis[];
  enabled: boolean;
  limit: number;
  policyKey: "reembolso_bundle" | "skin_test_bundle";
}): MatchHypothesis[] {
  if (!params.enabled || params.amountHint == null) return [];
  const amountHint = params.amountHint;

  const eligible = params.analyses
    .filter((analysis) => analysis.candidate.linkedEventsCount === 0)
    .filter((analysis) => analysis.exactRutMatch);
  if (eligible.length < 2) return [];

  const bundles = new Map<string, MatchHypothesis>();
  const visit = (startIndex: number, current: CandidateAnalysis[]) => {
    if (current.length >= 2) {
      const totalAmount = current.reduce((sum, analysis) => sum + analysis.document.totalAmount, 0);
      const amountDiff = Math.abs(amountHint - totalAmount);
      if (amountDiff <= MAX_AUTO_LINK_AMOUNT_DIFF) {
        const sorted = [...current].sort((a, b) =>
          a.document.dteSaleDetailId.localeCompare(b.document.dteSaleDetailId)
        );
        const dteSaleDetailIds = sorted.map((analysis) => analysis.document.dteSaleDetailId);
        const bundleHeader =
          params.policyKey === "reembolso_bundle"
            ? `Bundle de ${sorted.length} DTE de reembolso (Roxair/Bactek) y mismo RUT`
            : `Bundle de ${sorted.length} DTE del mismo día y mismo RUT`;
        const reasons = [
          bundleHeader,
          `Suma total ${currencyFormatterForReason(totalAmount)} frente a evento ${currencyFormatterForReason(amountHint)}`,
        ];
        if (amountDiff <= 500) {
          reasons.push("La suma del bundle coincide casi exacto");
        } else if (amountDiff <= 2000) {
          reasons.push("La suma del bundle es cercana");
        } else {
          reasons.push("La suma del bundle es compatible");
        }
        if (sorted.some((analysis) => analysis.exactNameMatch)) {
          reasons.push("El bundle conserva coincidencias nominales fuertes");
        }

        const score = Math.min(100, amountDiff <= 500 ? 100 : amountDiff <= 2000 ? 96 : 92);
        bundles.set(dteSaleDetailIds.join("|"), {
          amountDiff,
          autoLinkEligible: score >= MIN_AUTO_LINK_SCORE,
          clientName: sorted[0].document.clientName,
          clientRUT: sorted[0].document.clientRUT,
          crossSeriesConflicts: [
            ...new Map(
              sorted.flatMap((a) => a.crossSeriesConflicts).map((c) => [c.seriesId, c])
            ).values(),
          ],
          documentDate: sorted[0].document.documentDate,
          documents: sorted.map((analysis) => analysis.document),
          dteSaleDetailIds,
          folios: sorted.map((analysis) => analysis.document.folio),
          hypothesisId: `bundle:${dteSaleDetailIds.join("|")}`,
          kind: "bundle",
          method: combineMethod(sorted.map((analysis) => analysis.method)),
          policyKey: params.policyKey,
          reasons,
          score,
          signals: [
            toSignal("bundle_same_rut", "Bundle mismo RUT", 95),
            toSignal("bundle_size", "Cantidad de DTE", 0, String(sorted.length)),
            toSignal(
              "bundle_amount",
              amountDiff <= 500
                ? "Suma bundle coincide casi exacto"
                : amountDiff <= 2000
                  ? "Suma bundle cercana"
                  : "Suma bundle compatible",
              amountDiff <= 500 ? 8 : amountDiff <= 2000 ? 5 : 3,
              currencyFormatterForReason(totalAmount)
            ),
          ],
          totalAmount,
        });
      }
    }

    if (current.length === 3) return;
    for (let index = startIndex; index < eligible.length; index += 1) {
      current.push(eligible[index]);
      visit(index + 1, current);
      current.pop();
    }
  };
  visit(0, []);

  return [...bundles.values()]
    .sort((a, b) => {
      const diffA = a.amountDiff ?? Number.POSITIVE_INFINITY;
      const diffB = b.amountDiff ?? Number.POSITIVE_INFINITY;
      if (diffA !== diffB) return diffA - diffB;
      if (a.score !== b.score) return b.score - a.score;
      return a.hypothesisId.localeCompare(b.hypothesisId);
    })
    .slice(0, params.limit);
}

async function getEventByExternalIds(
  calendarGoogleId: string,
  externalEventId: string
): Promise<EventRow | null> {
  const rows = await db.$queryRaw<EventRow[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "googleCalendarId",
      e.external_event_id AS "externalEventId",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.category AS "category",
      e.summary AS "summary",
      e.description AS "description",
      e.clinical_series_id AS "clinicalSeriesId",
      link_stats."linkedDteSaleDetailId" AS "linkedDteSaleDetailId",
      link_stats."linkedCount" AS "linkedCount",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedCount",
        MIN(l.dte_sale_detail_id) AS "linkedDteSaleDetailId"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE c.google_id = ${calendarGoogleId}
      AND e.external_event_id = ${externalEventId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getEventsByDate(date: string): Promise<EventRow[]> {
  return db.$queryRaw<EventRow[]>`
    SELECT
      e.id AS "eventId",
      c.google_id AS "googleCalendarId",
      e.external_event_id AS "externalEventId",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      e.category AS "category",
      e.summary AS "summary",
      e.description AS "description",
      e.clinical_series_id AS "clinicalSeriesId",
      link_stats."linkedDteSaleDetailId" AS "linkedDteSaleDetailId",
      link_stats."linkedCount" AS "linkedCount",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedCount",
        MIN(l.dte_sale_detail_id) AS "linkedDteSaleDetailId"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) = ${date}::date
    ORDER BY e.start_date_time ASC NULLS LAST, e.id ASC
  `;
}

async function retrieveDteCandidates(params: {
  amountHint: null | number;
  excludeDteSaleDetailIds?: string[];
  from: string;
  nameClaims: string[];
  rutClaims: string[];
  seriesLinkedRuts: string[];
  surnameClaims: string[];
  to: string;
}): Promise<DteSaleRow[]> {
  const excludedIds = params.excludeDteSaleDetailIds ?? [];
  const loweredNameClaims = params.nameClaims.map((value) => normalizeName(value)).filter(Boolean);
  const loweredSurnameClaims = params.surnameClaims
    .map((value) => normalizeName(value))
    .filter(Boolean);
  const normalizedSeriesLinkedRuts = params.seriesLinkedRuts.map(
    (value) => normalizeRut(value) || value
  );

  return db.$queryRaw<DteSaleRow[]>`
    SELECT
      s.id AS "dteSaleDetailId",
      s.document_type AS "documentType",
      s.client_rut AS "clientRUT",
      s.client_name AS "clientName",
      s.folio AS "folio",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      COALESCE(s.exempt_amount, 0)::float AS "exemptAmount",
      COALESCE(s.net_amount, 0)::float AS "netAmount",
      COALESCE(s.iva_amount, 0)::float AS "ivaAmount",
      COALESCE(s.total_amount, 0)::float AS "totalAmount",
      (
        SELECT COUNT(*)::int
        FROM event_dte_sale_links l
        WHERE l.dte_sale_detail_id = s.id
      ) AS "linkedEventsCount",
      json_build_object(
        'exactRutMatch', (
          cardinality(${params.rutClaims}::text[]) > 0
          AND s.client_rut = ANY(${params.rutClaims}::text[])
        ),
        'sameSeriesRutMatch', (
          cardinality(${normalizedSeriesLinkedRuts}::text[]) > 0
          AND s.client_rut = ANY(${normalizedSeriesLinkedRuts}::text[])
        ),
        'amountCandidate', (
          ${params.amountHint}::float8 IS NOT NULL
          AND ABS(COALESCE(s.total_amount, 0)::float - ${params.amountHint}::float8) <= ${MAX_AUTO_LINK_AMOUNT_DIFF}
        ),
        'sharedSurnameMatch', EXISTS (
          SELECT 1
          FROM unnest(${loweredSurnameClaims}::text[]) AS surname_hint
          WHERE surname_hint <> ''
            AND f_unaccent(lower(s.client_name)) LIKE '%' || f_unaccent(surname_hint) || '%'
        ),
        -- word_similarity(query, text) measures how well the query appears as a
        -- contiguous word-substring of text — much better than similarity() for
        -- partial names (e.g. "nadia yanez" inside "YAÑEZ ROJAS NADIA VALENTINA").
        -- f_unaccent normalises ñ→n, á→a etc. using the immutable wrapper so the
        -- GIN index on f_unaccent(lower(client_name)) is used.
        'trigramSimilarity', COALESCE((
          SELECT MAX(word_similarity(f_unaccent(name_hint), f_unaccent(lower(s.client_name))))
          FROM unnest(${loweredNameClaims}::text[]) AS name_hint
        ), 0)
      ) AS "retrievalMeta"
    FROM dte_sale_details s
    WHERE s.document_date BETWEEN ${params.from}::date AND ${params.to}::date
      AND s.document_type <> 61
      AND (
        cardinality(${excludedIds}::text[]) = 0
        OR s.id <> ALL(${excludedIds}::text[])
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dte_sale_details nce
        WHERE nce.document_type = 61
          AND nce.reference_doc_type = s.document_type::varchar
          AND nce.reference_doc_folio = s.folio
      )
      AND (
        (
          cardinality(${params.rutClaims}::text[]) > 0
          AND s.client_rut = ANY(${params.rutClaims}::text[])
        )
        OR (
          cardinality(${normalizedSeriesLinkedRuts}::text[]) > 0
          AND s.client_rut = ANY(${normalizedSeriesLinkedRuts}::text[])
        )
        OR (
          ${params.amountHint}::float8 IS NOT NULL
          AND ABS(COALESCE(s.total_amount, 0)::float - ${params.amountHint}::float8) <= ${MAX_AUTO_LINK_AMOUNT_DIFF}
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(${loweredSurnameClaims}::text[]) AS surname_hint
          WHERE surname_hint <> ''
            AND f_unaccent(lower(s.client_name)) LIKE '%' || f_unaccent(surname_hint) || '%'
        )
        -- word_similarity with the <% operator lets the GIN index on
        -- f_unaccent(lower(client_name)) accelerate this path.
        -- Threshold 0.35 is intentionally low for retrieval; scoring in
        -- analyzeCandidate re-ranks with tighter criteria.
        OR (
          cardinality(${loweredNameClaims}::text[]) > 0
          AND EXISTS (
            SELECT 1
            FROM unnest(${loweredNameClaims}::text[]) AS name_hint
            WHERE f_unaccent(name_hint) <% f_unaccent(lower(s.client_name))
          )
        )
      )
    ORDER BY
      (
        CASE
          WHEN cardinality(${params.rutClaims}::text[]) > 0 AND s.client_rut = ANY(${params.rutClaims}::text[]) THEN 1
          WHEN cardinality(${normalizedSeriesLinkedRuts}::text[]) > 0
            AND s.client_rut = ANY(${normalizedSeriesLinkedRuts}::text[]) THEN 1
          ELSE 0
        END
      ) DESC,
      ABS(COALESCE(s.total_amount, 0)::float - COALESCE(${params.amountHint}::float8, COALESCE(s.total_amount, 0)::float)) ASC,
      s.document_date DESC,
      s.folio DESC
  `;
}

function buildHypotheses(params: {
  claims: EventIdentityClaims;
  candidates: DteSaleRow[];
  crossSeriesWarningByRut?: Map<string, CrossSeriesConflictInfo>;
  event: Pick<EventRow, "category" | "description" | "summary">;
  fallbackLimit: number;
  limit: number;
}): {
  candidateSetSummary: CandidateSetSummary;
  fallbackCandidates: EventDteSuggestion[];
  hypotheses: MatchHypothesis[];
} {
  const analyses = params.candidates.map((candidate) =>
    analyzeCandidate({
      amountHint: params.claims.amountHint,
      candidate,
      crossSeriesWarningByRut: params.crossSeriesWarningByRut,
      nameClaims: params.claims.nameClaims,
      rutClaims: params.claims.rutClaims,
      seriesLinkedRuts: params.claims.seriesLinkedRuts,
    })
  );

  const singleHypotheses = analyses
    .map((analysis) => buildSingleHypothesis(analysis, params.claims))
    .filter((hypothesis) => hypothesis.score >= MIN_REVIEW_SCORE);

  const bundlePolicyKey: null | "reembolso_bundle" | "skin_test_bundle" =
    params.claims.seriesKind === "SKIN_TEST"
      ? "skin_test_bundle"
      : isReembolsoBundleEvent(params.event)
        ? "reembolso_bundle"
        : null;

  const bundleHypotheses =
    bundlePolicyKey == null
      ? []
      : buildBundleHypotheses({
          amountHint: params.claims.amountHint,
          analyses,
          enabled: true,
          limit: params.limit,
          policyKey: bundlePolicyKey,
        });

  const hypotheses = [...bundleHypotheses, ...singleHypotheses]
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const diffA = a.amountDiff ?? Number.POSITIVE_INFINITY;
      const diffB = b.amountDiff ?? Number.POSITIVE_INFINITY;
      if (diffA !== diffB) return diffA - diffB;
      if (a.kind !== b.kind) return a.kind === "bundle" ? -1 : 1;
      return a.hypothesisId.localeCompare(b.hypothesisId);
    })
    .slice(0, params.limit);

  const hypothesisDocIds = new Set(hypotheses.flatMap((hypothesis) => hypothesis.dteSaleDetailIds));
  const fallbackCandidates = analyses
    .filter((analysis) => analysis.candidate.linkedEventsCount === 0)
    .filter((analysis) => !hypothesisDocIds.has(analysis.document.dteSaleDetailId))
    .sort((a, b) => {
      const diffA = a.amountDiff ?? Number.POSITIVE_INFINITY;
      const diffB = b.amountDiff ?? Number.POSITIVE_INFINITY;
      if (diffA !== diffB) return diffA - diffB;
      return b.score - a.score;
    })
    .slice(0, params.fallbackLimit)
    .map((analysis) => ({
      ...analysis.document,
      reasons: [...analysis.document.reasons, "DTE del mismo día sin eventos vinculados"],
    }));

  return {
    candidateSetSummary: {
      consideredCount: analyses.length,
      fallbackCount: fallbackCandidates.length,
      retrievedCount: params.candidates.length,
      sameDayCount: params.candidates.filter(
        (candidate) => candidate.documentDate === params.claims.eventDate
      ).length,
    },
    fallbackCandidates,
    hypotheses,
  };
}

export async function getEventDteSuggestions(params: {
  calendarId: string;
  eventId: string;
  limit?: number;
  sameDayOnly?: boolean;
}) {
  let event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) {
    return {
      candidateSetSummary: {
        consideredCount: 0,
        fallbackCount: 0,
        retrievedCount: 0,
        sameDayCount: 0,
      },
      event: null,
      fallbackCandidates: [] as EventDteSuggestion[],
      hypotheses: [] as MatchHypothesis[],
      identityClaims: null as EventIdentityClaims | null,
      linked: [] as EventDteLinkRecord[],
      linkedDocuments: [] as EventDteLinkedDocument[],
      series: null as ClinicalSeriesSnapshot | null,
    };
  }

  if (event.clinicalSeriesId == null) {
    await syncClinicalSeriesForInternalEventId(event.eventId);
    event = await getEventByExternalIds(params.calendarId, params.eventId);
    if (!event) {
      return {
        candidateSetSummary: {
          consideredCount: 0,
          fallbackCount: 0,
          retrievedCount: 0,
          sameDayCount: 0,
        },
        event: null,
        fallbackCandidates: [] as EventDteSuggestion[],
        hypotheses: [] as MatchHypothesis[],
        identityClaims: null as EventIdentityClaims | null,
        linked: [] as EventDteLinkRecord[],
        linkedDocuments: [] as EventDteLinkedDocument[],
        series: null as ClinicalSeriesSnapshot | null,
      };
    }
  }

  const [linked, series] = await Promise.all([
    getEventDteLinksByInternalEventId(event.eventId),
    getClinicalSeriesSnapshotByExternalEvent({
      calendarId: params.calendarId,
      eventId: params.eventId,
    }),
  ]);

  const sameDayOnly = params.sameDayOnly ?? false;
  const claims = extractIdentityClaims({ event, sameDayOnly, series });
  const suggestionDateWindow = resolveSuggestionDateWindow({
    event,
    sameDayOnly,
    series,
  });
  const from = suggestionDateWindow.from;
  const to = suggestionDateWindow.to;
  const excludeIds = series?.linkedDocuments.map((item) => item.dteSaleDetailId) ?? [];
  const surnameClaims = [...new Set(claims.nameClaims.flatMap((claim) => surnameTokens(claim)))];

  const candidates = await retrieveDteCandidates({
    amountHint: claims.amountHint,
    excludeDteSaleDetailIds: excludeIds,
    from,
    nameClaims: claims.nameClaims,
    rutClaims: claims.rutClaims,
    seriesLinkedRuts: claims.seriesLinkedRuts,
    surnameClaims,
    to,
  });

  const crossSeriesWarningByRut =
    series != null
      ? await getSameKindRutConflictWarnings({
          candidateRuts: candidates.map((candidate) => candidate.clientRUT),
          currentBeneficiaryRut: series.beneficiaryRut ?? null,
          currentPatientName: series.patientName,
          currentPatientRut: series.patientRut,
          seriesId: series.id,
          seriesKind: series.kind,
        })
      : new Map<string, CrossSeriesConflictInfo>();

  const { candidateSetSummary, fallbackCandidates, hypotheses } = buildHypotheses({
    claims,
    candidates,
    crossSeriesWarningByRut,
    event,
    fallbackLimit: params.limit ?? 5,
    limit: params.limit ?? 15,
  });

  return {
    candidateSetSummary,
    event: {
      amountExpected: event.amountExpected,
      amountPaid: event.amountPaid,
      calendarId: event.googleCalendarId,
      description: event.description,
      eventDate: event.eventDate,
      eventId: event.externalEventId,
      summary: event.summary,
    },
    fallbackCandidates,
    hypotheses: hypotheses.map((hypothesis, index) => {
      if (index <= 1) return hypothesis;
      return hypothesis;
    }),
    identityClaims: claims,
    linked,
    linkedDocuments: linked.map((entry) => ({
      clientName: entry.dte.clientName,
      clientRUT: entry.dte.clientRUT,
      confidenceScore: entry.confidenceScore,
      documentDate: entry.dte.documentDate,
      dteSaleDetailId: entry.dteSaleDetailId,
      folio: entry.dte.folio,
      matchedBy: entry.matchedBy,
      totalAmount: entry.dte.totalAmount,
    })),
    series,
  };
}

export async function listEventDteLinksByDate(date: string) {
  const rows = await db.$queryRaw<
    Array<{
      calendarId: string;
      clientName: string;
      clientRUT: string;
      confidenceScore: number;
      dteSaleDetailId: string;
      eventId: string;
      folio: string;
      matchedBy: string;
      status: string;
      totalAmount: number;
    }>
  >`
    SELECT
      c.google_id AS "calendarId",
      e.external_event_id AS "eventId",
      l.dte_sale_detail_id AS "dteSaleDetailId",
      l.status AS "status",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN calendars c ON c.id = e.calendar_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) = ${date}::date
    ORDER BY e.start_date_time ASC NULLS LAST, e.id ASC, s.folio ASC
  `;

  return rows;
}

export async function listEventDteLinkOverview(params: {
  page?: number;
  pageSize?: number;
  period: string;
  query?: string;
  status?: "all" | "linked" | "pending_issuance" | "unlinked";
}) {
  const page = Math.max(0, params.page ?? 0);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
  const status = params.status ?? "all";
  const trimmedQuery = params.query?.trim() ?? "";
  const hasSearch = trimmedQuery.length > 0;
  const offset = page * pageSize;
  if (!PERIOD_REGEX.test(params.period)) throw new Error("Periodo inválido. Usa formato YYYY-MM");
  const today = toChileDateString(new Date());
  const { from: periodStart, to: periodEnd } = getMonthRange(params.period);
  const searchLike = `%${trimmedQuery}%`;

  const statsRows = await db.$queryRaw<
    Array<{
      avgLinkedScore: null | number;
      dueEvents: number;
      linkedDueEvents: number;
      linkedEvents: number;
      pendingIssuanceEvents: number;
      totalEvents: number;
      unlinkedEvents: number;
      withPerfectScore: number;
    }>
  >`
    SELECT
      COUNT(*)::int AS "totalEvents",
      COUNT(*) FILTER (WHERE link_stats."linkedCount" > 0)::int AS "linkedEvents",
      COUNT(*) FILTER (
        WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "dueEvents",
      COUNT(*) FILTER (
        WHERE link_stats."linkedCount" > 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "linkedDueEvents",
      COUNT(*) FILTER (
        WHERE link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
      )::int AS "unlinkedEvents",
      COUNT(*) FILTER (
        WHERE link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
      )::int AS "pendingIssuanceEvents",
      COUNT(*) FILTER (WHERE link_stats."maxConfidenceScore" = 100)::int AS "withPerfectScore",
      AVG(link_stats."avgConfidenceScore") FILTER (WHERE link_stats."linkedCount" > 0) AS "avgLinkedScore"
    FROM events e
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedCount",
        MAX(l.confidence_score::float) AS "maxConfidenceScore",
        AVG(l.confidence_score::float) AS "avgConfidenceScore"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
  `;

  const totalCountRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM events e
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "linkedCount"
      FROM event_dte_sale_links l
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
      AND (
        (
          ${status} = 'all'
          AND (
            link_stats."linkedCount" > 0
            OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
          )
        )
        OR (${status} = 'linked' AND link_stats."linkedCount" > 0)
        OR (
          ${status} = 'unlinked'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
        )
        OR (
          ${status} = 'pending_issuance'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
        )
      )
      AND (
        ${hasSearch} = false
        OR COALESCE(e.summary, '') ILIKE ${searchLike}
        OR COALESCE(e.description, '') ILIKE ${searchLike}
      )
  `;
  const totalCount = totalCountRows[0]?.count ?? 0;

  const rows = await db.$queryRaw<EventDteOverviewRow[]>`
    SELECT
      c.google_id AS "calendarId",
      e.external_event_id AS "eventId",
      e.summary AS "summary",
      COALESCE(to_char(e.start_date, 'YYYY-MM-DD'), to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')) AS "eventDate",
      to_char(e.start_date_time AT TIME ZONE ${TIMEZONE}, 'HH24:MI') AS "eventTime",
      e.amount_expected AS "amountExpected",
      e.amount_paid AS "amountPaid",
      e.clinical_series_id AS "clinicalSeriesId",
      auto_skip."lastAutoLinkSkipAt" AS "lastAutoLinkSkipAt",
      auto_skip."lastAutoLinkSkipReason" AS "lastAutoLinkSkipReason",
      link_stats."linkedCount" AS "linkedCount",
      link_stats."linkedDocumentsJson" AS "linkedDocumentsJson",
      link_stats."linkedDteSaleDetailId" AS "linkedDteSaleDetailId",
      link_stats."linkedMatchedBy" AS "linkedMatchedBy",
      link_stats."confidenceScore" AS "confidenceScore",
      link_stats."linkedClientName" AS "linkedClientName",
      link_stats."linkedClientRUT" AS "linkedClientRUT",
      link_stats."linkedFolio" AS "linkedFolio",
      link_stats."linkedTotalAmount" AS "linkedTotalAmount",
      cs.display_name AS "displayName",
      cs.kind AS "seriesKind"
    FROM events e
    JOIN calendars c ON c.id = e.calendar_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedCount",
        MIN(l.dte_sale_detail_id) AS "linkedDteSaleDetailId",
        MIN(l.matched_by) AS "linkedMatchedBy",
        MAX(l.confidence_score::float) AS "confidenceScore",
        MIN(s.client_name) AS "linkedClientName",
        MIN(s.client_rut) AS "linkedClientRUT",
        MIN(s.folio) AS "linkedFolio",
        COALESCE(SUM(s.total_amount), 0)::float AS "linkedTotalAmount",
        COALESCE(
          json_agg(
            json_build_object(
              'clientName', s.client_name,
              'clientRUT', s.client_rut,
              'confidenceScore', l.confidence_score::float,
              'documentDate', to_char(s.document_date, 'YYYY-MM-DD'),
              'dteSaleDetailId', l.dte_sale_detail_id,
              'folio', s.folio,
              'matchedBy', l.matched_by,
              'totalAmount', COALESCE(s.total_amount, 0)::float
            )
            ORDER BY s.folio ASC
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) AS "linkedDocumentsJson"
      FROM event_dte_sale_links l
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE l.event_id = e.id
    ) link_stats ON TRUE
    LEFT JOIN clinical_series cs ON e.clinical_series_id = cs.id
    LEFT JOIN LATERAL (
      SELECT
        a.created_at AS "lastAutoLinkSkipAt",
        a.reason AS "lastAutoLinkSkipReason"
      FROM event_dte_auto_link_attempts a
      WHERE a.event_id = e.id
        AND a.status = 'SKIPPED'
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ) auto_skip ON TRUE
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${periodEnd}::date
      AND (
        (
          ${status} = 'all'
          AND (
            link_stats."linkedCount" > 0
            OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
          )
        )
        OR (${status} = 'linked' AND link_stats."linkedCount" > 0)
        OR (
          ${status} = 'unlinked'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
        )
        OR (
          ${status} = 'pending_issuance'
          AND link_stats."linkedCount" = 0
          AND COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) > ${today}::date
        )
      )
      AND (
        ${hasSearch} = false
        OR COALESCE(e.summary, '') ILIKE ${searchLike}
        OR COALESCE(e.description, '') ILIKE ${searchLike}
      )
    ORDER BY COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) DESC, e.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const items = await Promise.all(
    rows.map(async (row) => {
      const linkedDocuments = parseLinkedDocumentsJson(row.linkedDocumentsJson);
      const isDueForEmission = row.eventDate <= today;
      const linkStatus: "linked" | "pending_issuance" | "unlinked" =
        row.linkedCount > 0 ? "linked" : isDueForEmission ? "unlinked" : "pending_issuance";

      let topHypothesis: MatchHypothesis | null = null;
      if (row.linkedCount === 0 && isDueForEmission) {
        const suggestions = await getEventDteSuggestions({
          calendarId: row.calendarId,
          eventId: row.eventId,
          limit: 3,
          sameDayOnly: true,
        });
        topHypothesis = suggestions.hypotheses[0] ?? null;
      }

      return {
        amountExpected: row.amountExpected,
        amountPaid: row.amountPaid,
        calendarId: row.calendarId,
        clinicalSeriesId: row.clinicalSeriesId,
        confidenceScore: row.confidenceScore,
        displayName: row.displayName,
        eventDate: row.eventDate,
        eventTime: row.eventTime,
        eventId: row.eventId,
        lastAutoLinkSkip:
          row.lastAutoLinkSkipReason && row.lastAutoLinkSkipAt
            ? {
                attemptedAt: row.lastAutoLinkSkipAt.toISOString(),
                reason: row.lastAutoLinkSkipReason,
              }
            : null,
        linkStatus,
        linked: row.linkedCount > 0,
        linkedClientName: row.linkedClientName,
        linkedClientRUT: row.linkedClientRUT,
        linkedDocuments: linkedDocuments.map((document) => ({
          clientName: document.clientName,
          clientRUT: document.clientRUT,
          confidenceScore: document.confidenceScore,
          dteSaleDetailId: document.dteSaleDetailId,
          folio: document.folio,
          matchedBy: document.matchedBy,
          totalAmount: document.totalAmount,
        })),
        linkedDteSaleDetailId: row.linkedDteSaleDetailId,
        linkedFolio: row.linkedFolio,
        linkedMatchedBy: row.linkedMatchedBy,
        linkedTotalAmount: row.linkedTotalAmount,
        seriesKind: row.seriesKind,
        summary: row.summary,
        topHypothesis,
      };
    })
  );

  const stats = statsRows[0] ?? {
    avgLinkedScore: null,
    dueEvents: 0,
    linkedDueEvents: 0,
    linkedEvents: 0,
    pendingIssuanceEvents: 0,
    totalEvents: 0,
    unlinkedEvents: 0,
    withPerfectScore: 0,
  };

  return {
    items,
    page,
    pageSize,
    period: params.period,
    stats: {
      avgLinkedScore: stats.avgLinkedScore ?? 0,
      dueEvents: stats.dueEvents,
      linkedEvents: stats.linkedEvents,
      linkRate:
        stats.dueEvents > 0
          ? Number(((stats.linkedDueEvents / stats.dueEvents) * 100).toFixed(1))
          : 0,
      totalEvents: stats.totalEvents,
      pendingIssuanceEvents: stats.pendingIssuanceEvents,
      unlinkedEvents: stats.unlinkedEvents,
      withPerfectScore: stats.withPerfectScore,
    },
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getEventDteLinksByInternalEventId(
  eventId: number
): Promise<EventDteLinkRecord[]> {
  const rows = await db.$queryRaw<
    Array<{
      clientName: string;
      clientRUT: string;
      confidenceScore: number;
      createdAt: Date;
      createdBy: null | number;
      documentDate: string;
      documentType: number;
      dteSaleDetailId: string;
      eventId: number;
      evidence: unknown;
      folio: string;
      id: number;
      matchedBy: string;
      matchedName: null | string;
      matchedRUT: null | string;
      status: "CONFIRMED" | "MANUAL" | "REJECTED";
      totalAmount: number;
      updatedAt: Date;
    }>
  >`
    SELECT
      l.id AS "id",
      l.event_id AS "eventId",
      l.dte_sale_detail_id AS "dteSaleDetailId",
      l.status AS "status",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore",
      l.matched_rut AS "matchedRUT",
      l.matched_name AS "matchedName",
      l.evidence AS "evidence",
      l.created_by AS "createdBy",
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      s.document_type AS "documentType",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE l.event_id = ${eventId}
      AND l.status != 'REJECTED'
    ORDER BY s.document_date ASC, s.folio ASC
  `;

  return rows.map((row) => ({
    confidenceScore: row.confidenceScore,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    dte: {
      clientName: row.clientName,
      clientRUT: row.clientRUT,
      documentDate: row.documentDate,
      documentType: row.documentType,
      folio: row.folio,
      totalAmount: row.totalAmount,
    },
    dteSaleDetailId: row.dteSaleDetailId,
    evidence: row.evidence,
    eventId: row.eventId,
    id: row.id,
    matchedBy: row.matchedBy,
    matchedName: row.matchedName,
    matchedRUT: row.matchedRUT,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function confirmEventDteLink(params: {
  calendarId: string;
  confidenceScore?: number;
  dteSaleDetailIds: string[];
  eventId: string;
  hypothesis?: unknown;
  hypothesisKind?: HypothesisKind;
  matchedBy?: "manual" | MatchMethod;
  matchedName?: null | string;
  matchedRUT?: null | string;
  policyKey?: PolicyKey;
  userId: number;
}) {
  const event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) throw new Error("Evento no encontrado");

  const normalizedDteSaleDetailIds = [...new Set(params.dteSaleDetailIds)].slice(0, 3);
  if (normalizedDteSaleDetailIds.length === 0) {
    throw new Error("Debes indicar al menos un DTE para confirmar el vínculo");
  }

  const dteRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT s.id
    FROM dte_sale_details s
    WHERE s.id = ANY(${normalizedDteSaleDetailIds}::text[])
  `;
  if (dteRows.length !== normalizedDteSaleDetailIds.length) {
    throw new Error("Uno o más DTE de venta no existen");
  }

  const previousLinks = await getEventDteLinksByInternalEventId(event.eventId);

  await db.$executeRaw`
    DELETE FROM event_dte_sale_links
    WHERE event_id = ${event.eventId}
       OR dte_sale_detail_id = ANY(${normalizedDteSaleDetailIds}::text[])
  `;

  const evidence = JSON.stringify(
    params.hypothesis ?? {
      bundleSize: normalizedDteSaleDetailIds.length,
      policyKey: params.policyKey ?? "default_same_day",
      source: "manual_confirm",
    }
  );

  for (const dteSaleDetailId of normalizedDteSaleDetailIds) {
    await db.$executeRaw`
      INSERT INTO event_dte_sale_links (
        event_id,
        dte_sale_detail_id,
        status,
        matched_by,
        confidence_score,
        matched_rut,
        matched_name,
        evidence,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        ${event.eventId},
        ${dteSaleDetailId},
        'MANUAL',
        ${params.matchedBy ?? "manual"},
        ${Math.max(0, Math.min(100, params.confidenceScore ?? 100))},
        ${params.matchedRUT ?? null},
        ${params.matchedName ?? null},
        ${evidence}::jsonb,
        ${params.userId},
        NOW(),
        NOW()
      )
      ON CONFLICT (dte_sale_detail_id)
      DO UPDATE SET
        event_id = EXCLUDED.event_id,
        status = EXCLUDED.status,
        matched_by = EXCLUDED.matched_by,
        confidence_score = EXCLUDED.confidence_score,
        matched_rut = EXCLUDED.matched_rut,
        matched_name = EXCLUDED.matched_name,
        evidence = EXCLUDED.evidence,
        created_by = EXCLUDED.created_by,
        updated_at = NOW()
    `;
  }

  await recordMatchReview({
    action: previousLinks.length > 0 ? "manual_override" : "confirmed",
    createdBy: params.userId,
    dteSaleDetailIds: normalizedDteSaleDetailIds,
    eventId: event.eventId,
    hypothesis: params.hypothesis ?? null,
    hypothesisKind:
      params.hypothesisKind ?? (normalizedDteSaleDetailIds.length > 1 ? "bundle" : "single"),
  });

  return getEventDteLinksByInternalEventId(event.eventId);
}

export async function unlinkEventDteLink(params: {
  calendarId: string;
  eventId: string;
  userId?: number;
}) {
  const event = await getEventByExternalIds(params.calendarId, params.eventId);
  if (!event) return { deleted: false };

  const previousLinks = await getEventDteLinksByInternalEventId(event.eventId);
  const deleted = await db.$executeRaw`
    DELETE FROM event_dte_sale_links
    WHERE event_id = ${event.eventId}
  `;

  if (previousLinks.length > 0) {
    await recordMatchReview({
      action: "unlinked",
      createdBy: params.userId ?? null,
      dteSaleDetailIds: previousLinks.map((link) => link.dteSaleDetailId),
      eventId: event.eventId,
      hypothesis: previousLinks,
      hypothesisKind: previousLinks.length > 1 ? "bundle" : "single",
    });
  }

  return { deleted: Number(deleted) > 0 };
}

function hypothesisSkipReason(
  hypothesis: MatchHypothesis | undefined,
  second: MatchHypothesis | undefined
): string {
  if (!hypothesis) return "Sin candidatos";
  if (hypothesis.score < MIN_AUTO_LINK_SCORE) {
    return hypothesis.kind === "bundle"
      ? `Score bajo bundle (${hypothesis.score})`
      : `Score bajo (${hypothesis.score})`;
  }
  if (hypothesis.amountDiff != null && hypothesis.amountDiff > MAX_AUTO_LINK_AMOUNT_DIFF) {
    return hypothesis.kind === "bundle"
      ? `Monto bundle no coincide (dif ${Math.round(hypothesis.amountDiff)})`
      : `Monto no coincide (dif ${Math.round(hypothesis.amountDiff)})`;
  }
  if (isHypothesisAmbiguous(hypothesis, second)) return "Ambiguo";
  if (!hypothesis.autoLinkEligible) return "Sin candidatos";
  return "Conflicto global";
}

export function selectGlobalAutoLinkHypotheses(
  entries: Array<{ event: EventRow; hypotheses: MatchHypothesis[] }>
) {
  const candidateEntries = entries.map((entry) => ({
    event: entry.event,
    hypotheses: entry.hypotheses.filter((hypothesis) => hypothesis.autoLinkEligible).slice(0, 3),
  }));

  const totalHypotheses = candidateEntries.reduce((sum, entry) => sum + entry.hypotheses.length, 0);
  if (totalHypotheses > 36 || candidateEntries.length > 18) {
    const chosen = new Map<string, MatchHypothesis>();
    const usedEvents = new Set<string>();
    const usedDtes = new Set<string>();
    const pool = candidateEntries
      .flatMap((entry) =>
        entry.hypotheses.map((hypothesis) => ({
          eventId: entry.event.externalEventId,
          hypothesis,
        }))
      )
      .sort((a, b) => b.hypothesis.score - a.hypothesis.score);
    for (const item of pool) {
      if (usedEvents.has(item.eventId)) continue;
      if (item.hypothesis.dteSaleDetailIds.some((id) => usedDtes.has(id))) continue;
      chosen.set(item.eventId, item.hypothesis);
      usedEvents.add(item.eventId);
      for (const id of item.hypothesis.dteSaleDetailIds) usedDtes.add(id);
    }
    return chosen;
  }

  const ordered = [...candidateEntries].sort((a, b) => a.hypotheses.length - b.hypotheses.length);
  let bestScore = -1;
  let best = new Map<string, MatchHypothesis>();

  const maxRemaining = new Array<number>(ordered.length + 1).fill(0);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const maxScore = ordered[index].hypotheses[0]?.score ?? 0;
    maxRemaining[index] = maxRemaining[index + 1] + maxScore;
  }

  const visit = (
    index: number,
    currentScore: number,
    current: Map<string, MatchHypothesis>,
    usedDtes: Set<string>
  ) => {
    if (currentScore + maxRemaining[index] < bestScore) return;
    if (index >= ordered.length) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        best = new Map(current);
      }
      return;
    }

    const entry = ordered[index];
    visit(index + 1, currentScore, current, usedDtes);

    for (const hypothesis of entry.hypotheses) {
      if (hypothesis.dteSaleDetailIds.some((id) => usedDtes.has(id))) continue;
      const nextUsed = new Set(usedDtes);
      for (const id of hypothesis.dteSaleDetailIds) nextUsed.add(id);
      current.set(entry.event.externalEventId, hypothesis);
      visit(index + 1, currentScore + hypothesis.score, current, nextUsed);
      current.delete(entry.event.externalEventId);
    }
  };

  visit(0, 0, new Map(), new Set());
  return best;
}

export async function autoLinkEventDate(params: {
  date: string;
  minScore?: number;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const today = toChileDateString(new Date());
  if (params.date > today) {
    throw new Error(
      `No se puede auto-vincular una fecha futura (${params.date}). Hoy es ${today} en ${TIMEZONE}.`
    );
  }

  const minScore = params.minScore ?? MIN_AUTO_LINK_SCORE;
  const strategy = params.strategy ?? "missing_only";
  const events = await getEventsByDate(params.date);
  const eventsToProcess =
    strategy === "relink_all" ? events : events.filter((event) => event.linkedCount === 0);

  const suggestionEntries = await Promise.all(
    eventsToProcess.map(async (event) => {
      const suggestions = await getEventDteSuggestions({
        calendarId: event.googleCalendarId,
        eventId: event.externalEventId,
        limit: 5,
        sameDayOnly: true,
      });
      const eligible = suggestions.hypotheses
        .filter((hypothesis) => hypothesis.score >= minScore)
        .filter(
          (hypothesis) =>
            hypothesis.amountDiff == null || hypothesis.amountDiff <= MAX_AUTO_LINK_AMOUNT_DIFF
        )
        .filter((hypothesis, index, array) => !isHypothesisAmbiguous(hypothesis, array[index + 1]));
      return { event, eligible, suggestions };
    })
  );

  const selected = selectGlobalAutoLinkHypotheses(
    suggestionEntries.map((entry) => ({ event: entry.event, hypotheses: entry.eligible }))
  );

  let linked = 0;
  let skipped = 0;
  const details: Array<{ eventId: string; reason: string }> = [];
  const skippedByReason = new Map<string, number>();

  for (const entry of suggestionEntries) {
    const chosen = selected.get(entry.event.externalEventId);
    if (!chosen) {
      const reason = hypothesisSkipReason(
        entry.suggestions.hypotheses[0],
        entry.suggestions.hypotheses[1]
      );
      skipped += 1;
      await recordAutoLinkAttempt({
        confidenceScore: entry.suggestions.hypotheses[0]?.score,
        dteSaleDetailId: entry.suggestions.hypotheses[0]?.dteSaleDetailIds[0] ?? null,
        eventId: entry.event.eventId,
        reason,
        status: "SKIPPED",
        userId: params.userId,
      });
      incrementReason(skippedByReason, reason);
      details.push({ eventId: entry.event.externalEventId, reason });
      continue;
    }

    await confirmEventDteLink({
      calendarId: entry.event.googleCalendarId,
      confidenceScore: chosen.score,
      dteSaleDetailIds: chosen.dteSaleDetailIds,
      eventId: entry.event.externalEventId,
      hypothesis: chosen,
      hypothesisKind: chosen.kind,
      matchedBy: chosen.method,
      matchedName: chosen.clientName,
      matchedRUT: chosen.clientRUT,
      policyKey: chosen.policyKey,
      userId: params.userId,
    });
    await recordAutoLinkAttempt({
      confidenceScore: chosen.score,
      dteSaleDetailId: chosen.dteSaleDetailIds[0] ?? null,
      eventId: entry.event.eventId,
      reason:
        chosen.kind === "bundle"
          ? `Auto-linked bundle (${chosen.score})`
          : `Auto-linked (${chosen.score})`,
      status: "LINKED",
      userId: params.userId,
    });
    linked += 1;
    details.push({
      eventId: entry.event.externalEventId,
      reason:
        chosen.kind === "bundle"
          ? `Auto-linked bundle (${chosen.score})`
          : `Auto-linked (${chosen.score})`,
    });
  }

  return {
    date: params.date,
    details,
    linked,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    totalEvents: eventsToProcess.length,
  };
}

export async function autoLinkEventPeriod(params: {
  minScore?: number;
  period: string;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  if (!PERIOD_REGEX.test(params.period)) throw new Error("Periodo inválido. Usa formato YYYY-MM");

  const today = toChileDateString(new Date());
  const { from: periodStart, to: periodEnd } = getMonthRange(params.period);
  const maxDate = periodEnd < today ? periodEnd : today;

  if (periodStart > maxDate) {
    return {
      daysProcessed: 0,
      details: [] as Array<{ date: string; linked: number; skipped: number; totalEvents: number }>,
      linked: 0,
      period: params.period,
      skipped: 0,
      skippedByReason: [] as SkipReasonCount[],
      totalEvents: 0,
    };
  }

  const dateRows = await db.$queryRaw<Array<{ eventDate: string }>>`
    SELECT DISTINCT
      COALESCE(
        to_char(e.start_date, 'YYYY-MM-DD'),
        to_char((e.start_date_time AT TIME ZONE ${TIMEZONE})::date, 'YYYY-MM-DD')
      ) AS "eventDate"
    FROM events e
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date)
      BETWEEN ${periodStart}::date AND ${maxDate}::date
    ORDER BY "eventDate" ASC
  `;

  const details: Array<{ date: string; linked: number; skipped: number; totalEvents: number }> = [];
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;
  const skippedByReason = new Map<string, number>();

  for (const row of dateRows) {
    const result = await autoLinkEventDate({
      date: row.eventDate,
      minScore: params.minScore,
      strategy: params.strategy,
      userId: params.userId,
    });
    totalEvents += result.totalEvents;
    linked += result.linked;
    skipped += result.skipped;
    for (const reasonCount of result.skippedByReason) {
      incrementReason(skippedByReason, reasonCount.reason, reasonCount.count);
    }
    details.push({
      date: row.eventDate,
      linked: result.linked,
      skipped: result.skipped,
      totalEvents: result.totalEvents,
    });
  }

  return {
    daysProcessed: details.length,
    details,
    linked,
    period: params.period,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    totalEvents,
  };
}

export async function autoLinkAllEventPeriods(params: {
  minScore?: number;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const strategy = params.strategy ?? "missing_only";
  const periodRows = await listAutoLinkEligiblePeriods();
  const periodConcurrency = 3;
  const queue = [...periodRows];
  const details: AutoLinkPeriodSummary[] = [];
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;
  const skippedByReason = new Map<string, number>();

  const workers = Array.from({ length: Math.min(periodConcurrency, queue.length || 1) }, () =>
    (async () => {
      while (true) {
        const row = queue.shift();
        if (!row) return;

        const result = await autoLinkEventPeriod({
          minScore: params.minScore,
          period: row.period,
          strategy,
          userId: params.userId,
        });

        totalEvents += result.totalEvents;
        linked += result.linked;
        skipped += result.skipped;
        for (const reasonCount of result.skippedByReason) {
          incrementReason(skippedByReason, reasonCount.reason, reasonCount.count);
        }
        details.push({
          daysProcessed: result.daysProcessed,
          linked: result.linked,
          period: row.period,
          skipped: result.skipped,
          totalEvents: result.totalEvents,
        });
      }
    })()
  );

  await Promise.all(workers);

  return {
    details,
    linked,
    periodsProcessed: details.length,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    totalEvents,
  };
}

export async function listAutoLinkEligiblePeriods() {
  const today = toChileDateString(new Date());
  return db.$queryRaw<Array<{ period: string }>>`
    SELECT DISTINCT
      to_char(COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date), 'YYYY-MM') AS "period"
    FROM events e
    WHERE COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${today}::date
    ORDER BY "period" DESC
  `;
}

export async function autoLinkAllEventPeriodsWithProgress(params: {
  minScore?: number;
  onProgress?: (snapshot: AutoLinkProgressSnapshot) => void;
  periodConcurrency?: number;
  periods: Array<{ period: string }>;
  strategy?: AutoLinkStrategy;
  userId: number;
}) {
  const strategy = params.strategy ?? "missing_only";
  const queue = [...params.periods];
  const details: AutoLinkPeriodSummary[] = [];
  const concurrency = Math.max(1, Math.min(params.periodConcurrency ?? 3, 6));
  let totalEvents = 0;
  let linked = 0;
  let skipped = 0;
  let completedPeriods = 0;
  const skippedByReason = new Map<string, number>();

  const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, () =>
    (async () => {
      while (true) {
        const row = queue.shift();
        if (!row) return;

        const result = await autoLinkEventPeriod({
          minScore: params.minScore,
          period: row.period,
          strategy,
          userId: params.userId,
        });

        totalEvents += result.totalEvents;
        linked += result.linked;
        skipped += result.skipped;
        for (const reasonCount of result.skippedByReason) {
          incrementReason(skippedByReason, reasonCount.reason, reasonCount.count);
        }
        details.push({
          daysProcessed: result.daysProcessed,
          linked: result.linked,
          period: row.period,
          skipped: result.skipped,
          totalEvents: result.totalEvents,
        });

        completedPeriods += 1;
        params.onProgress?.({
          completedPeriods,
          currentPeriod: row.period,
          linked,
          skipped,
          totalEvents,
          totalPeriods: params.periods.length,
        });
      }
    })()
  );

  await Promise.all(workers);
  details.sort((a, b) => b.period.localeCompare(a.period));

  return {
    details,
    linked,
    periodsProcessed: details.length,
    skipped,
    skippedByReason: normalizeReasonCounts(skippedByReason),
    strategy,
    totalEvents,
  };
}

export function normalizeLinkDate(input: string): string {
  // A link date is a CALENDAR DATE (the day the user picked), not an instant. The
  // DB compares it as `${date}::date` against the event's local date (start_date,
  // or start_date_time AT TIME ZONE TIMEZONE), so the input must round-trip its
  // Y/M/D exactly. We validate the components directly (UTC, no instant/tz
  // conversion, no dayjs plugin dependency) so the result is timezone-independent
  // by construction — the prior `dayjs(input).tz(TIMEZONE)` shifted the day by one
  // whenever the process TZ was at/east of UTC (CI runs UTC → off-by-one), and
  // strict calendar validity depended on whether customParseFormat was loaded.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) throw new Error("Fecha inválida. Usa formato YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates (month 13, Feb 30, …) that would otherwise roll over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Fecha inválida. Usa formato YYYY-MM-DD");
  }
  return input;
}
