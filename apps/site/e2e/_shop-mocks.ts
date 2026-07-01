import type { Page, Route } from "@playwright/test";
import superjson from "superjson";

/**
 * Deterministic oRPC mocks for the ecommerce (tienda) flows.
 *
 * The site's oRPC client posts SAME-ORIGIN to `/api/orpc/<ns>/rpc/<proc>` and
 * speaks the SuperJSON wire format: the response body is `superjson.serialize(data)`
 * → `{ json: <data>, meta?: <type annotations> }`. The client runs
 * `superjson.deserialize({ json, meta })`, so Date-typed contract fields MUST be
 * carried with their superjson meta or they'd arrive as plain strings and break
 * `.getTime()` / `.toFixed()` callers. We therefore build plain JS fixtures
 * (Dates as real `Date` objects) and let `superjson.serialize` emit the correct
 * envelope — this keeps the fixtures contract-accurate without hand-rolling meta.
 *
 * Fixtures mirror the Zod output schemas in:
 *   - packages/orpc-contracts/src/catalog.ts  (productSchema, publicShopConfigResponseSchema, productReviewListResponseSchema)
 *   - packages/orpc-contracts/src/cart.ts     (cartResponseSchema)
 *   - packages/orpc-contracts/src/checkout.ts (checkoutQuoteResponseSchema, checkoutStartResponseSchema)
 *
 * All handlers are mutation-free / deterministic: cart "add"/"update" return a
 * fixed non-empty cart so /carrito and /checkout always render populated.
 */

const NOW = new Date("2026-01-01T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Fixtures (plain JS, contract-shaped)
// ---------------------------------------------------------------------------

type ProductImageFixture = {
  id: number;
  product_id: number;
  r2_key: string;
  cdn_url: string;
  srcset: string | null;
  avif_srcset: string | null;
  jxl_srcset: string | null;
  alt: string | null;
  position: number;
  width: number | null;
  height: number | null;
  is_primary: boolean;
};

function image(productId: number): ProductImageFixture {
  return {
    id: productId * 10,
    product_id: productId,
    // A tiny inline SVG keeps the build hermetic — no network image fetch.
    r2_key: `products/${productId}/primary.svg`,
    cdn_url:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="%23ddd"/></svg>'
      ),
    srcset: null,
    avif_srcset: null,
    jxl_srcset: null,
    alt: `Imagen producto ${productId}`,
    position: 0,
    width: 800,
    height: 800,
    is_primary: true,
  };
}

const CATEGORY = {
  id: 1,
  slug: "cuidado-piel",
  name: "Cuidado de la piel",
  description: null,
  parent_id: null,
  display_order: 0,
  ml_category_id: null,
  image_url: null,
  created_at: NOW,
  updated_at: NOW,
};

type ProductFixture = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category_id: number | null;
  category: typeof CATEGORY | null;
  brand: string | null;
  price_clp: number;
  compare_at_price_clp: number | null;
  cost_clp: number | null;
  weight_grams: number | null;
  width_cm: number | null;
  height_cm: number | null;
  length_cm: number | null;
  barcode: string | null;
  requires_prescription: boolean;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  seo_title: string | null;
  seo_description: string | null;
  available_qty: number;
  safety_stock: number;
  images: ProductImageFixture[];
  created_at: Date;
  updated_at: Date;
};

function product(
  id: number,
  overrides: Partial<ProductFixture> & Pick<ProductFixture, "slug" | "name" | "price_clp">
): ProductFixture {
  return {
    id,
    sku: `SKU-${id}`,
    short_description: `Descripción corta del producto ${id}.`,
    description: `Descripción larga y detallada del producto ${id}.`,
    category_id: CATEGORY.id,
    category: CATEGORY,
    brand: "Bioalergia",
    compare_at_price_clp: null,
    cost_clp: null,
    weight_grams: 250,
    width_cm: 10,
    height_cm: 8,
    length_cm: 15,
    barcode: null,
    requires_prescription: false,
    status: "ACTIVE",
    seo_title: null,
    seo_description: null,
    available_qty: 25,
    safety_stock: 3,
    images: [image(id)],
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

/**
 * Three products with DISTINCT prices so the sort assertions are deterministic.
 * Order here is the API/"relevancia" order; price ascending is Crema < Spray <
 * Loción, descending is the reverse.
 */
export const PRODUCTS: ProductFixture[] = [
  product(101, {
    slug: "crema-hidratante-facial",
    name: "Crema Hidratante Facial",
    price_clp: 8990,
    compare_at_price_clp: 11990,
  }),
  product(102, {
    slug: "spray-nasal-suero",
    name: "Spray Nasal de Suero Fisiológico",
    price_clp: 14990,
  }),
  product(103, {
    slug: "locion-corporal-calmante",
    name: "Loción Corporal Calmante",
    price_clp: 21990,
    available_qty: 4, // low stock → "Últimas unidades"
  }),
];

function firstProduct(): ProductFixture {
  const [p] = PRODUCTS;
  if (!p) throw new Error("PRODUCTS fixture is empty");
  return p;
}

export const DEFAULT_PRODUCT_SLUG = firstProduct().slug;

function productBySlug(slug: string): ProductFixture {
  return PRODUCTS.find((p) => p.slug === slug) ?? firstProduct();
}

function cartFixture() {
  const p = firstProduct();
  const qty = 2;
  const subtotal = p.price_clp * qty;
  return {
    id: 1,
    currency: "CLP",
    items: [
      {
        id: 1,
        product_id: p.id,
        qty,
        unit_price_clp: p.price_clp,
        product: {
          id: p.id,
          sku: p.sku,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          primary_image_url: p.images[0]?.cdn_url ?? null,
          available_qty: p.available_qty,
        },
      },
    ],
    subtotal_clp: subtotal,
    total_clp: subtotal,
    item_count: qty,
  };
}

// ---------------------------------------------------------------------------
// Response builders (catalog/cart/checkout) → superjson envelopes
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

/** Maps a procedure name (last URL segment) to the data object it returns. */
function responseFor(proc: string, body: Json): unknown | undefined {
  switch (proc) {
    case "publicConfig":
      return { data: { low_stock_threshold: 3 }, status: "ok" };

    case "list": {
      // Honor category_slug filtering so RelatedProducts gets a sane set, and
      // never include the excluded id implicitly (component filters anyway).
      const input = (body.json ?? {}) as { category_slug?: string };
      const rows = input.category_slug
        ? PRODUCTS.filter((p) => p.category?.slug === input.category_slug)
        : PRODUCTS;
      return { data: rows, next_cursor: null, status: "ok" };
    }

    case "getBySlug": {
      const input = (body.json ?? {}) as { slug?: string };
      return { data: productBySlug(input.slug ?? DEFAULT_PRODUCT_SLUG), status: "ok" };
    }

    case "getById": {
      const input = (body.json ?? {}) as { id?: number };
      const found = PRODUCTS.find((p) => p.id === input.id) ?? firstProduct();
      return { data: found, status: "ok" };
    }

    case "listReviews":
      return { data: [], aggregate: { count: 0, average: 0 }, status: "ok" };

    // Cart: read + all mutations resolve to the same deterministic non-empty cart.
    case "get":
    case "addItem":
    case "updateItem":
    case "removeItem":
      return { data: cartFixture(), status: "ok" };

    case "clear":
      return { status: "ok" };

    // Checkout
    case "quote":
      return {
        data: {
          options: [
            {
              service_code: "EXP",
              service_description: "Chilexpress Express",
              shipping_clp: 4990,
              delivery_time_days: "1-2",
            },
            {
              service_code: "STD",
              service_description: "Chilexpress Estándar",
              shipping_clp: 3490,
              delivery_time_days: "3-5",
            },
          ],
        },
        status: "ok",
      };

    case "start":
      return {
        data: {
          order_id: 9001,
          order_number: "BA-2026-0001",
          mp_order_id: "MP-TEST-1",
          mp_status: "approved",
          mp_status_detail: "accredited",
          total_clp: cartFixture().total_clp,
        },
        status: "ok",
      };

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
 * Installs deterministic mocks for every `/api/orpc/**` POST. Known procedures
 * get contract-accurate fixtures; anything unmocked falls back to a generic
 * `{ json: { ok: true }, meta: [] }` 200 so nothing in the page hangs on a
 * pending request.
 */
export async function installShopMocks(page: Page): Promise<void> {
  await page.route("**/api/orpc/**", async (route) => {
    const url = new URL(route.request().url());
    // path: /api/orpc/<ns>/rpc/<proc>
    const proc = url.pathname.split("/").pop() ?? "";

    let body: Json = {};
    try {
      body = (route.request().postDataJSON() as Json) ?? {};
    } catch {
      body = {};
    }

    const data = responseFor(proc, body);
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
