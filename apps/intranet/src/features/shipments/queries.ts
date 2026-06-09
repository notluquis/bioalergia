// Centralized query-key factory for the shipments feature.
//
// Hierarchical const pattern (mirrors features/calendar/queries.ts `calendarKeys`
// + features/finance/queries.ts `cashflowKeys`). IMPORTANT: the array SHAPES
// below are load-bearing — every queryKey and its matching invalidateQueries/
// setQueryData call must stay structurally identical or invalidation silently
// breaks (TanStack matches keys by structural prefix). Each factory reproduces
// the exact raw array previously inlined.
//
// Chilexpress geo lookups (`cx-*`) are NOT defined here — they live in
// features/addresses/queries.ts `cxKeys` (shared by both features) and are
// re-exported below for ergonomic in-feature imports.
export { cxKeys } from "@/features/addresses/queries";

export const shipmentKeys = {
  // Broad root. NOTE: the global shipments LIST query is keyed ["shipments-all"]
  // (its own disjoint namespace, NOT a child of ["shipments"]). `all`/`byPatient`
  // mirror the pre-existing ["shipments", patientId] invalidation in
  // CreateShipmentWizard — preserved verbatim (no behavior change), even though
  // that key has never matched the ["shipments-all"] list query.
  all: ["shipments"] as const,
  byPatient: (patientId: number) => ["shipments", patientId] as const,
  // The page-level list + every mutation invalidation use this exact key.
  allShipments: ["shipments-all"] as const,
  // Active courier manifest (single global entry).
  manifestActive: ["shipment-manifest-active"] as const,
  // Per-shipment Chilexpress tracking timeline.
  tracking: (shipmentId: number | null) => ["shipment-tracking", shipmentId] as const,
} as const;
