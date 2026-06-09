import type { Key } from "@heroui/react";

// Centralized query-key factories for the addresses feature.
//
// Hierarchical const pattern (mirrors features/calendar/queries.ts `calendarKeys`
// + features/finance/queries.ts `cashflowKeys`): the base `all` is a structural
// PREFIX of its children, so a broad invalidateQueries(addressKeys.all) cascades.
//
// IMPORTANT: the array SHAPES below are load-bearing — every queryKey and its
// matching invalidateQueries/setQueryData/fetchQuery call must stay structurally
// identical or invalidation silently breaks (TanStack matches keys by structural
// prefix). Each factory reproduces the exact raw array previously inlined.

export const addressKeys = {
  // Broad root + per-person list. `byPerson` is the only address list query;
  // it's keyed by numeric personId (NOT stringified — matches every existing
  // ["addresses", personId] call site in addresses + shipments features).
  all: ["addresses"] as const,
  byPerson: (personId: number) => ["addresses", personId] as const,
} as const;

// Shared Chilexpress (cx) geo-lookup keys. Centralized ONCE here and imported
// by BOTH addresses and shipments so the two features reference identical keys
// (Chilexpress regions/communes/streets/offices/quotes are global, not per
// feature).
//
// NOTE ON VALUE TYPES: some `cx-*` namespaces are hit from multiple call sites
// that pass DIFFERENT value types for the same positional slot — e.g.
// `cx-communes` receives a `Key | null` (shipments CoverageStep, un-stringified
// regionId) AND a `string` (addresses form, stringified region). The factory
// params accept the union and do NOT coerce, so each produced array is byte-for
// -byte identical to what the call site inlined before. Do not "normalize" these
// — coercion would change the cache key and break the cache hit.
export const cxKeys = {
  regions: ["cx-regions"] as const,
  communes: (regionId: Key | null) => ["cx-communes", regionId] as const,
  communesType2: (regionValue: string) => ["cx-communes-type2", regionValue] as const,
  offices: (regionId: Key | null, communeName: string, officeKind: "0" | "4") =>
    ["cx-offices", regionId, communeName, officeKind] as const,
  nearbyOffices: (addressId: number | null) => ["cx-nearby-offices", addressId] as const,
  streets: (countyName: string, query: string) => ["cx-streets", countyName, query] as const,
  streetNumbers: (streetId: number | null) => ["cx-street-numbers", streetId] as const,
  quote: (
    coverageRegionCode: string | undefined,
    weight: number,
    height: number,
    width: number,
    length: number,
    declaredValue: number
  ) => ["cx-quote", coverageRegionCode, weight, height, width, length, declaredValue] as const,
} as const;
