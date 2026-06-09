// Centralized query-key factory for the patients feature.
//
// Hierarchical const pattern (mirrors features/calendar/queries.ts `calendarKeys`).
// IMPORTANT: the array SHAPES below are load-bearing — every queryKey and its
// matching invalidateQueries/setQueryData call must stay structurally identical
// or invalidation silently breaks (TanStack matches keys by structural prefix).
//
// Cross-file note: the patient DETAIL query (`["patient", id]`) is defined and
// consumed in routes/_authed/patients/$id/** (out of scope here). `detail()`
// reproduces that exact shape so the in-feature attachment-upload invalidation
// keeps hitting the same cache entry. Do NOT change `detail`'s shape without
// updating those routes too.
export const patientKeys = {
  // Broad list root. Also a structural PREFIX of `nameSearch` below, so
  // invalidateQueries(patientKeys.all) refreshes the list AND every active
  // name-search query — that prefix relationship is intentional.
  all: ["patients"] as const,
  clinicalSeries: (patientId: number) => ["patient-clinical-series", patientId] as const,
  // Singular "patient" detail entry, keyed by route/string id (see cross-file note).
  detail: (id: number | string) => ["patient", id] as const,
  nameSearch: (name: string) => ["patients", name] as const,
  personByRut: (rut: string) => ["person-by-rut", rut] as const,
  skinTests: (patientId: number) => ["patient-skin-tests", patientId] as const,
} as const;
