import type { Page, Route } from "@playwright/test";
import superjson from "superjson";

/**
 * Deterministic oRPC mocks for the venta-a-empresas (reactivos) flows.
 *
 * Like `_shop-mocks.ts`, the site's oRPC client posts SAME-ORIGIN to
 * `/api/orpc/<ns>/rpc/<proc>` and speaks the SuperJSON wire format: the
 * response body is `superjson.serialize(data)` → `{ json, meta? }`, which the
 * client runs through `superjson.deserialize`. We build plain JS fixtures and
 * let `superjson.serialize` emit the correct envelope.
 *
 * Fixtures mirror the Zod output schemas in
 *   packages/orpc-contracts/src/reactivos.ts
 *     - reactivoVitrinaResponseSchema  → { items: ReactivoVitrinaItemDto[] }
 *     - createReactivoLeadResponseSchema → { ok: true, id: number }
 *
 * The vitrina DTO carries NO price field by design (`unitPrice` never leaves
 * the API for the public surface) — the fixtures honor that.
 *
 * All handlers are mutation-free / deterministic: createLead always returns a
 * fixed success so the lead form always reaches its thank-you state.
 */

// ---------------------------------------------------------------------------
// Fixtures (plain JS, contract-shaped — NO price field)
// ---------------------------------------------------------------------------

type AllergenFixture = {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string;
};

export type ReactivoVitrinaItemFixture = {
  id: number;
  slug: string | null;
  code: string | null;
  brand: string | null;
  category: string | null;
  name: string;
  format: string | null;
  description: string | null;
  imageUrl: string | null;
  allergen: AllergenFixture | null;
};

// A tiny inline SVG keeps the build hermetic — no network image fetch.
const INLINE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="%23ddd"/></svg>'
  );

/**
 * Three vitrina items with distinct names + a known allergen commonName so the
 * "renders vitrina" assertions are deterministic.
 */
export const VITRINA_ITEMS: ReactivoVitrinaItemFixture[] = [
  {
    id: 201,
    slug: "extracto-dermatophagoides",
    code: "ALG-DPT",
    brand: "Inmunotek",
    category: "Ácaros",
    name: "Extracto Dermatophagoides pteronyssinus",
    format: "Vial 5 mL",
    description: "Extracto alergénico para pruebas cutáneas de ácaros del polvo.",
    imageUrl: INLINE_SVG,
    allergen: {
      id: "alg_dpt",
      commonName: "Ácaro del polvo doméstico",
      scientificName: "Dermatophagoides pteronyssinus",
      category: "Ácaros",
    },
  },
  {
    id: 202,
    slug: "extracto-gramineas",
    code: "ALG-GRA",
    brand: "Roxall",
    category: "Pólenes",
    name: "Mezcla de Gramíneas",
    format: "Vial 3 mL",
    description: "Reactivo para pruebas cutáneas de pólenes de gramíneas.",
    imageUrl: INLINE_SVG,
    allergen: {
      id: "alg_gramineas",
      commonName: "Polen de gramíneas",
      scientificName: "Lolium perenne",
      category: "Pólenes",
    },
  },
  {
    id: 203,
    slug: "control-histamina",
    code: "CTRL-HIS",
    brand: "Diater",
    category: "Controles",
    name: "Control Positivo de Histamina",
    format: "Vial 2 mL",
    description: "Control positivo para validar la respuesta cutánea.",
    imageUrl: null,
    allergen: null,
  },
];

/** The allergen commonName surfaced by the first card — asserted in the spec. */
export const VITRINA_ALLERGEN_COMMON_NAME = "Ácaro del polvo doméstico";

// ---------------------------------------------------------------------------
// Response builders → superjson envelopes
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

/** Maps a procedure name (last URL segment) to the data object it returns. */
function responseFor(proc: string): unknown | undefined {
  switch (proc) {
    // GET vitrina pública (output: { items }).
    case "listVitrina":
      return { items: VITRINA_ITEMS };

    // POST lead público (output: { ok: true, id }).
    case "createLead":
      return { ok: true, id: 1 };

    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

async function fulfillSuperjson(route: Route, data: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(superjson.serialize(data)),
  });
}

/**
 * Installs deterministic mocks for every `/api/orpc/**` POST. Known reactivos
 * procedures get contract-accurate fixtures; anything else (shell calls etc.)
 * falls back to a generic `{ json: { ok: true }, meta: [] }` 200 so nothing in
 * the page hangs on a pending request.
 */
export async function installReactivosMocks(page: Page): Promise<void> {
  await page.route("**/api/orpc/**", async (route) => {
    const url = new URL(route.request().url());
    // path: /api/orpc/<ns>/rpc/<proc>
    const proc = url.pathname.split("/").pop() ?? "";

    const data = responseFor(proc);
    if (data === undefined) {
      // Generic deterministic fallback — keeps unknown procs from hanging.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ json: { ok: true }, meta: [] }),
      });
      return;
    }

    await fulfillSuperjson(route, data);
  });
}
