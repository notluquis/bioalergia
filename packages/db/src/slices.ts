// Sliced ZenStack clients per feature surface.
//
// Each export here is the `db` from `./client.ts` narrowed to a
// specific set of models via `$setOptions({ slicing:
// { includedModels: […] } })`. The slicing API is the ZenStack v3
// canonical pattern documented at zenstack.dev/docs/orm/advanced/slicing
// — it preserves the dialect (and therefore the shared `pg` pool
// from client.ts) and only narrows the type-level + runtime model
// surface.
//
// Services that touch a small number of models should import their
// feature's slice instead of the full `db`. Fewer models means a
// smaller ZenStack relation graph for tsgo to resolve per file,
// which keeps `app.ts` and other broad consumers from blowing the
// inference budget when 30+ orpc handlers each pull their own
// service tree.
//
// Slices keep the public `ClientContract<SchemaType>` shape via an
// `as unknown as ClientContract<SchemaType>` cast so call sites
// don't change — only the import line moves.

import type { ClientContract } from "@zenstackhq/orm";

import { db } from "./client.ts";
import type { SchemaType } from "./zenstack/schema.ts";

/** clinical-series feature surface — used by every sub-module under
 *  services/clinical-series/. Covers the series row + its event
 *  graph + abandonment audit + DTE link reads + merge log writes. */
export const dbClinicalSeries = db.$setOptions({
  ...db.$options,
  slicing: {
    includedModels: [
      "ClinicalSeries",
      "Event",
      "Calendar",
      "AbandonmentContact",
      "DTESaleDetail",
      "EventDteSaleLink",
      "ClinicalSeriesMergeLog",
    ],
  },
}) as unknown as ClientContract<SchemaType>;
