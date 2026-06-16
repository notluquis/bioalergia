// Centralized query-key factory for the immunotherapy feature.
//
// Hierarchical const pattern (mirrors features/calendar/queries.ts `calendarKeys`
// and features/patients/queries.ts `patientKeys`).
//
// Consumed by BOTH features/immunotherapy/pages/ImmunotherapySettingsPage.tsx
// and features/patients/pages/ImmunotherapyBudgetPage.tsx — previously each file
// inlined the same `["immuno", ...]` literals, which drifted independently.
//
// IMPORTANT: the array SHAPES below are load-bearing. `all` (= ["immuno"]) is a
// structural PREFIX of every child key, so a broad invalidateQueries(immunoKeys.all)
// would cascade to products / allergens / quote / terms. The settings page only
// invalidates the narrower `products` key — resolved arrays stay identical to the
// previous inline literals.
export const immunoKeys = {
  all: ["immuno"] as const,
  allergens: ["immuno", "allergens"] as const,
  products: ["immuno", "products"] as const,
  quote: (quoteInput: unknown) => ["immuno", "quote", quoteInput] as const,
  terms: ["immuno", "terms"] as const,
  scitPrescriptions: (patientId: number) => ["immuno", "scit-prescriptions", patientId] as const,
  administrations: (patientId: number) => ["immuno", "administrations", patientId] as const,
  adverseReactions: ["immuno", "adverse-reactions"] as const,
} as const;
