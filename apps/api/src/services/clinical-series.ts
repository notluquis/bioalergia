// services/clinical-series.ts
//
// Thin barrel re-export for the (previously monolithic, 4.6k-LOC)
// clinical-series module. The implementation lives under
// `./clinical-series/<feature>/<sub>.ts` (constants, types,
// normalization, extraction, classification, matching,
// identity-naming, context, metadata, assignment, status, rebuild,
// snapshot, stats, duplicates, abandonment). The split keeps tsgo's
// per-file inference budget healthy and prevents cascade implicit-any
// errors in downstream consumers.
//
// External consumers (orpc/clinical-series.ts, orpc/calendar.ts,
// app.ts) import from this file unchanged; nothing about the public
// API moved.

// ── Job state façade (no ZenStack imports — safe for SSE observers) ──
export type { RebuildJob } from "./clinical-series-rebuild-status.ts";
export { getCurrentRebuildJob } from "./clinical-series-rebuild-status.ts";

// ── Types ────────────────────────────────────────────────────────────
export type {
  ClinicalIdentity,
  ClinicalSeriesDuplicate,
  ClinicalSeriesEventSnapshot,
  ClinicalSeriesFilters,
  ClinicalSeriesInsuranceStats,
  ClinicalSeriesKind,
  ClinicalSeriesLinkedDocument,
  ClinicalSeriesSnapshot,
  ClinicalSeriesStageKind,
  DeliveryModality,
  EventSeriesCandidate,
  HealthInsuranceType,
  InsuranceEventLike,
  InsuranceResolution,
  StoredClinicalIdentity,
  StructuredClinicalDescription,
  SubcutaneousAllergenType,
  SubcutaneousVaccineProduct,
} from "./clinical-series/types.ts";

// ── Identity extraction + naming ─────────────────────────────────────
export {
  extractIdentityHints,
  extractPatientHints,
  resolveClinicalIdentity,
} from "./clinical-series/extraction/identity.ts";
export {
  selectRepresentativeClinicalIdentity,
  shouldPromoteBeneficiaryToPatientIdentity,
} from "./clinical-series/identity-naming/representative.ts";

// ── Insurance inference (used outside this module by reports) ────────
export { inferHealthInsurance } from "./clinical-series/classification/insurance.ts";

// ── Matching ─────────────────────────────────────────────────────────
export { findMatchingSeries } from "./clinical-series/matching/find.ts";

// ── Assignment + sync ────────────────────────────────────────────────
export {
  syncClinicalSeriesForEventIds,
  syncClinicalSeriesForExternalEvents,
  syncClinicalSeriesForInternalEventId,
} from "./clinical-series/assignment/sync.ts";

// ── Status + rebuild orchestration ───────────────────────────────────
export { updateAllSeriesStatuses } from "./clinical-series/status.ts";
export { rebuildClinicalSeries, startRebuildClinicalSeries } from "./clinical-series/rebuild.ts";

// ── Snapshots ────────────────────────────────────────────────────────
export { getClinicalSeriesSnapshotByExternalEvent } from "./clinical-series/snapshot/by-external-event.ts";
export { getClinicalSeriesSnapshotById } from "./clinical-series/snapshot/by-id.ts";
export { listClinicalSeriesSnapshots } from "./clinical-series/snapshot/list.ts";

// ── Stats ────────────────────────────────────────────────────────────
export { getClinicalSeriesInsuranceStats } from "./clinical-series/stats/insurance.ts";

// ── Duplicates ───────────────────────────────────────────────────────
export { detectDuplicateSeries } from "./clinical-series/duplicates/detect.ts";
export { mergeClinicalSeries } from "./clinical-series/duplicates/merge.ts";

// ── Abandonment contacts ─────────────────────────────────────────────
export {
  createAbandonmentContact,
  listAbandonmentContacts,
} from "./clinical-series/abandonment.ts";
