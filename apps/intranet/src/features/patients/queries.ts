import { queryOptions } from "@tanstack/react-query";
import { findPersonByRut } from "@/features/people/api";
import {
  fetchPatientClinicalSeries,
  fetchPatientDteSources,
  fetchPatients,
  fetchPatientSkinTests,
} from "./api";

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
  // DTE-source list (patient-source register tab). `dteSourcesAll` is a structural
  // PREFIX of `dteSources`, so invalidateQueries(dteSourcesAll) refreshes every
  // active DTE search query — same intentional prefix relationship as `all`.
  dteSources: (q: string) => ["patients", "dte-sources", q] as const,
  dteSourcesAll: ["patients", "dte-sources"] as const,
  nameSearch: (name: string) => ["patients", name] as const,
  personByRut: (rut: string) => ["person-by-rut", rut] as const,
  skinTests: (patientId: number) => ["patient-skin-tests", patientId] as const,
} as const;

// Full `queryOptions()` factory (key + queryFn bundled), mirroring
// features/calendar/queries.ts `calendarQueries`. Each entry reuses the shape
// from `patientKeys` for its queryKey, so invalidateQueries/setQueryData can
// reference either `patientKeys.X(...)` or `patientQueries.X(...).queryKey`
// (identical arrays). Call-site-specific options (e.g. `enabled` driven by
// local debounced state) are spread at the call site, not baked in here.
export const patientQueries = {
  clinicalSeries: (patientId: number) =>
    queryOptions({
      queryFn: () => fetchPatientClinicalSeries(patientId),
      queryKey: patientKeys.clinicalSeries(patientId),
      staleTime: 1000 * 60,
    }),
  dteSources: (q: string) =>
    queryOptions({
      queryFn: () => fetchPatientDteSources({ limit: 300, q }),
      queryKey: patientKeys.dteSources(q),
    }),
  nameSearch: (name: string) =>
    queryOptions({
      queryFn: () => fetchPatients(name),
      queryKey: patientKeys.nameSearch(name),
      staleTime: 1000 * 30,
    }),
  personByRut: (rut: string) =>
    queryOptions({
      queryFn: () => findPersonByRut(rut),
      queryKey: patientKeys.personByRut(rut),
      staleTime: 1000 * 30,
    }),
  skinTests: (patientId: number) =>
    queryOptions({
      queryFn: () => fetchPatientSkinTests(patientId),
      queryKey: patientKeys.skinTests(patientId),
      staleTime: 1000 * 60,
    }),
} as const;
