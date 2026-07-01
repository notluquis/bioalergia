// MSW handlers for the apps/site (tienda) Storybook.
//
// Mirrors apps/intranet/.storybook/msw-handlers.ts. Shop components call
// oRPC via TanStack Query (catalog.list / catalog.publicConfig / cart /
// checkout / account). Without a network mock those queries reject on the
// first `fetch('/api/orpc/…')` and the story renders an error state (or, in
// build-storybook / chromatic, an empty surface). These handlers return
// deterministic fixtures so every tienda story renders the happy path.
//
// Three principles (same as intranet):
//   1. Never hit the real DB — deterministic fixtures only.
//   2. Destructive verbs (delete/remove/update mutations) resolve to a fake
//      success with no state change, so play()/click stories are DB-safe.
//   3. Match oRPC's wire shape. All oRPC requests are POST to
//      `/api/orpc/<namespace>/rpc/<procedure>`. The site uses SuperJSONLink,
//      so the response body is `superjson.serialize(data)` → `{ json, meta }`.
//      We run the real `superjson.serialize` here so `Date` fields round-trip
//      back into the client as `Date` (matching the `z.date()` contracts).

import { cartSchema } from "@finanzas/orpc-contracts/cart";
import {
  productListResponseSchema,
  productResponseSchema,
  productReviewListResponseSchema,
  productSchema,
  publicShopConfigResponseSchema,
} from "@finanzas/orpc-contracts/catalog";
import { http, HttpResponse } from "msw";
import superjsonClass from "superjson";
import type { z } from "zod";

// `superjson` default export is a singleton instance (typed as the class).
const superjson = superjsonClass as unknown as {
  serialize: (data: unknown) => { json: unknown; meta?: unknown };
};

/**
 * Serialize a fixture the same way the api's SuperJSONRPCHandler does, so the
 * site's SuperJSONLink deserializes `Date` back into real `Date` objects.
 */
const ok = (data: unknown = { ok: true }) => HttpResponse.json(superjson.serialize(data));

/**
 * Anchor fixtures to the real oRPC Zod contracts. If a contract output schema
 * changes, this throws at module load so every story fails LOUDLY instead of
 * silently passing against a stale hand-typed shape (the classic MSW
 * false-green).
 */
function assertFixture<S extends z.ZodType>(schema: S, value: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `[msw-handlers] fixture "${label}" drifted from its oRPC contract:\n${result.error.message}`
    );
  }
  return result.data;
}

const NOW = new Date("2026-06-16T12:00:00Z");
const ISO = (s: string) => new Date(s).toISOString();

const IMG = (seed: string, primary = true) => ({
  id: Number.parseInt(seed.replace(/\D/g, "") || "1", 10),
  product_id: 1,
  r2_key: `products/${seed}.webp`,
  cdn_url: `https://picsum.photos/seed/${seed}/600/600`,
  srcset: `https://picsum.photos/seed/${seed}/300/300 300w, https://picsum.photos/seed/${seed}/600/600 600w`,
  avif_srcset: null,
  jxl_srcset: null,
  alt: "Producto de demostración",
  position: 0,
  width: 600,
  height: 600,
  is_primary: primary,
});

// ── Product fixtures across the storefront states ─────────────────────────
// `available_qty - safety_stock` drives the stock chip (see makeStockState):
//   > lowStockThreshold (3) → "Stock disponible"
//   1..3                   → "Últimas unidades"
//   <= 0                   → "Agotado"

const PRODUCT_IN_STOCK = {
  id: 1,
  slug: "spray-nasal-budesonida",
  sku: "SNB-064",
  name: "Spray Nasal Budesonida 64 mcg",
  short_description: "Corticoide nasal para rinitis alérgica.",
  description: "Spray nasal de budesonida para el control de la rinitis alérgica estacional.",
  category_id: 10,
  category: {
    id: 10,
    slug: "respiratorio",
    name: "Respiratorio",
    description: null,
    parent_id: null,
    display_order: 0,
    ml_category_id: null,
    image_url: null,
    created_at: NOW,
    updated_at: NOW,
  },
  brand: "Bioalergia",
  price_clp: 12_990,
  compare_at_price_clp: null,
  cost_clp: null,
  weight_grams: 120,
  width_cm: 10,
  height_cm: 8,
  length_cm: 15,
  barcode: null,
  requires_prescription: false,
  status: "ACTIVE" as const,
  seo_title: null,
  seo_description: null,
  available_qty: 40,
  safety_stock: 5,
  images: [IMG("snb064")],
  ml_listing: null,
  created_at: NOW,
  updated_at: NOW,
};

const PRODUCT_LOW_STOCK = {
  ...PRODUCT_IN_STOCK,
  id: 2,
  slug: "antihistaminico-cetirizina",
  sku: "ACE-010",
  name: "Cetirizina 10 mg — 30 comprimidos",
  brand: "Genérico",
  category_id: 11,
  category: {
    ...PRODUCT_IN_STOCK.category,
    id: 11,
    slug: "antihistaminicos",
    name: "Antihistamínicos",
  },
  price_clp: 4_490,
  compare_at_price_clp: null,
  available_qty: 7,
  safety_stock: 5, // effective 2 → "Últimas unidades"
  images: [IMG("ace010")],
};

const PRODUCT_OUT_OF_STOCK = {
  ...PRODUCT_IN_STOCK,
  id: 3,
  slug: "purificador-aire-hepa",
  sku: "PAH-001",
  name: "Purificador de Aire HEPA H13",
  brand: "AirPure",
  category_id: 12,
  category: { ...PRODUCT_IN_STOCK.category, id: 12, slug: "ambiente", name: "Ambiente" },
  price_clp: 159_990,
  compare_at_price_clp: null,
  available_qty: 5,
  safety_stock: 5, // effective 0 → "Agotado"
  images: [IMG("pah001")],
};

const PRODUCT_ON_SALE = {
  ...PRODUCT_IN_STOCK,
  id: 4,
  slug: "kit-control-acaros",
  sku: "KCA-002",
  name: "Kit Control de Ácaros — Funda + Spray",
  brand: "Bioalergia",
  category_id: 13,
  category: { ...PRODUCT_IN_STOCK.category, id: 13, slug: "acaros", name: "Control de Ácaros" },
  price_clp: 24_990,
  compare_at_price_clp: 34_990, // sale → strikethrough compare price
  available_qty: 22,
  safety_stock: 4,
  images: [IMG("kca002")],
};

const PRODUCT_RX = {
  ...PRODUCT_IN_STOCK,
  id: 5,
  slug: "adrenalina-autoinyector",
  sku: "ADR-300",
  name: "Autoinyector de Adrenalina 0,3 mg",
  brand: "EpiCare",
  category_id: 14,
  category: { ...PRODUCT_IN_STOCK.category, id: 14, slug: "emergencia", name: "Emergencia" },
  price_clp: 89_990,
  compare_at_price_clp: null,
  requires_prescription: true,
  available_qty: 15,
  safety_stock: 3,
  images: [IMG("adr300")],
};

export const PRODUCT_FIXTURES = {
  inStock: PRODUCT_IN_STOCK,
  lowStock: PRODUCT_LOW_STOCK,
  outOfStock: PRODUCT_OUT_OF_STOCK,
  onSale: PRODUCT_ON_SALE,
  rx: PRODUCT_RX,
  all: [PRODUCT_IN_STOCK, PRODUCT_LOW_STOCK, PRODUCT_OUT_OF_STOCK, PRODUCT_ON_SALE, PRODUCT_RX],
};

// Contract-anchored: drift in productSchema throws here at module load.
assertFixture(productSchema, PRODUCT_IN_STOCK, "PRODUCT_IN_STOCK");
assertFixture(productSchema, PRODUCT_LOW_STOCK, "PRODUCT_LOW_STOCK");
assertFixture(productSchema, PRODUCT_OUT_OF_STOCK, "PRODUCT_OUT_OF_STOCK");
assertFixture(productSchema, PRODUCT_ON_SALE, "PRODUCT_ON_SALE");
assertFixture(productSchema, PRODUCT_RX, "PRODUCT_RX");

const LIST_RESPONSE = {
  data: PRODUCT_FIXTURES.all,
  next_cursor: null,
  status: "ok" as const,
};
assertFixture(productListResponseSchema, LIST_RESPONSE, "LIST_RESPONSE");

const DETAIL_RESPONSE = { data: PRODUCT_IN_STOCK, status: "ok" as const };
assertFixture(productResponseSchema, DETAIL_RESPONSE, "DETAIL_RESPONSE");

const PUBLIC_CONFIG = { data: { low_stock_threshold: 3 }, status: "ok" as const };
assertFixture(publicShopConfigResponseSchema, PUBLIC_CONFIG, "PUBLIC_CONFIG");

// ── Reviews ───────────────────────────────────────────────────────────────
const REVIEWS_RESPONSE = {
  data: [
    {
      id: 1,
      product_id: 1,
      author_name: "Camila R.",
      rating: 5,
      title: "Excelente para la rinitis",
      body: "Lo uso hace un mes y mis síntomas bajaron muchísimo. Recomendado.",
      verified: true,
      created_at: new Date("2026-06-01T10:00:00Z"),
    },
    {
      id: 2,
      product_id: 1,
      author_name: "José P.",
      rating: 4,
      title: null,
      body: "Funciona bien, aunque el envase podría ser más grande.",
      verified: false,
      created_at: new Date("2026-05-20T10:00:00Z"),
    },
  ],
  aggregate: { count: 2, average: 4.5 },
  status: "ok" as const,
};
assertFixture(productReviewListResponseSchema, REVIEWS_RESPONSE, "REVIEWS_RESPONSE");

const REVIEWS_EMPTY_RESPONSE = {
  data: [],
  aggregate: { count: 0, average: 0 },
  status: "ok" as const,
};

// ── Cart ────────────────────────────────────────────────────────────────
const CART = {
  id: 1,
  currency: "CLP",
  items: [
    {
      id: 1,
      product_id: 1,
      qty: 2,
      unit_price_clp: 12_990,
      product: {
        id: 1,
        sku: "SNB-064",
        slug: "spray-nasal-budesonida",
        name: "Spray Nasal Budesonida 64 mcg",
        brand: "Bioalergia",
        primary_image_url: "https://picsum.photos/seed/snb064/600/600",
        available_qty: 40,
      },
    },
    {
      id: 2,
      product_id: 4,
      qty: 1,
      unit_price_clp: 24_990,
      product: {
        id: 4,
        sku: "KCA-002",
        slug: "kit-control-acaros",
        name: "Kit Control de Ácaros — Funda + Spray",
        brand: "Bioalergia",
        primary_image_url: "https://picsum.photos/seed/kca002/600/600",
        available_qty: 22,
      },
    },
  ],
  subtotal_clp: 50_970,
  total_clp: 50_970,
  item_count: 3,
};
const CART_RESPONSE = { data: CART, status: "ok" as const };
assertFixture(cartSchema, CART, "CART");

const EMPTY_CART_RESPONSE = {
  data: { ...CART, items: [], subtotal_clp: 0, total_clp: 0, item_count: 0 },
  status: "ok" as const,
};

// ── Checkout ──────────────────────────────────────────────────────────────
const CHECKOUT_QUOTE = {
  status: "ok" as const,
  data: {
    subtotal_clp: 50_970,
    shipping_clp: 3_990,
    total_clp: 54_960,
    options: [
      { code: "EXPRESS", label: "Chilexpress Express", price_clp: 3_990, eta_days: 2 },
      { code: "STANDARD", label: "Chilexpress Estándar", price_clp: 2_490, eta_days: 4 },
    ],
  },
};

// ── Account (mi-cuenta) ─────────────────────────────────────────────────
const ACCOUNT_ME = {
  status: "ok" as const,
  data: { id: 1, email: "demo@bioalergia.cl", name: "María José Pérez" },
};

const ACCOUNT_ORDERS = {
  status: "ok" as const,
  data: [
    {
      id: 1,
      number: "WEB-2026-0001",
      status: "PAID" as const,
      channel: "WEB" as const,
      total_clp: 54_960,
      subtotal_clp: 50_970,
      shipping_clp: 3_990,
      discount_clp: 0,
      dte_folio: "1024",
      dte_type: "BOLETA",
      created_at: ISO("2026-06-10T15:00:00Z"),
      item_count: 3,
    },
  ],
  next_cursor: null,
};

const ACCOUNT_ADDRESSES = {
  status: "ok" as const,
  data: [
    {
      id: 1,
      label: "Casa",
      street: "Av. Apoquindo",
      number: "5000",
      supplement: "Depto 802",
      reference: "Frente al metro",
      postal_code: "7560864",
      comuna: "Las Condes",
      region: "Metropolitana",
      is_primary: true,
    },
  ],
};

export const SHOP_FIXTURES = {
  list: LIST_RESPONSE,
  detail: DETAIL_RESPONSE,
  publicConfig: PUBLIC_CONFIG,
  reviews: REVIEWS_RESPONSE,
  reviewsEmpty: REVIEWS_EMPTY_RESPONSE,
  cart: CART_RESPONSE,
  emptyCart: EMPTY_CART_RESPONSE,
  checkoutQuote: CHECKOUT_QUOTE,
  accountMe: ACCOUNT_ME,
  accountOrders: ACCOUNT_ORDERS,
  accountAddresses: ACCOUNT_ADDRESSES,
};

/**
 * Default handlers attached to every story via preview.tsx. Per-story override
 * stays possible with `parameters: { msw: { handlers: [...] } }`.
 */
export const defaultHandlers = [
  // CSRF token — csrfFetch fetches this before every oRPC POST.
  http.get("*/api/csrf", () => HttpResponse.json({ token: "msw-fake-csrf" })),

  // Catalog (public storefront).
  http.post("*/api/orpc/catalog/rpc/publicConfig", () => ok(PUBLIC_CONFIG)),
  http.post("*/api/orpc/catalog/rpc/list", () => ok(LIST_RESPONSE)),
  http.post("*/api/orpc/catalog/rpc/getBySlug", () => ok(DETAIL_RESPONSE)),
  http.post("*/api/orpc/catalog/rpc/getById", () => ok(DETAIL_RESPONSE)),
  http.post("*/api/orpc/catalog/rpc/listReviews", () => ok(REVIEWS_RESPONSE)),
  http.post("*/api/orpc/catalog/rpc/submitReview", () =>
    ok({ data: { id: 99, status: "PENDING" }, status: "ok" })
  ),

  // Cart.
  http.post("*/api/orpc/cart/rpc/get", () => ok(CART_RESPONSE)),
  http.post("*/api/orpc/cart/rpc/addItem", () => ok(CART_RESPONSE)),
  http.post("*/api/orpc/cart/rpc/updateItem", () => ok(CART_RESPONSE)),
  http.post("*/api/orpc/cart/rpc/removeItem", () => ok(CART_RESPONSE)),

  // Checkout.
  http.post("*/api/orpc/checkout/rpc/quote", () => ok(CHECKOUT_QUOTE)),
  http.post("*/api/orpc/checkout/rpc/start", () =>
    ok({ status: "ok", data: { redirect_url: "https://mp.example/checkout" } })
  ),
  http.post("*/api/orpc/checkout/rpc/status", () => ok({ status: "ok", data: { paid: false } })),

  // Site auth (mi-cuenta session).
  http.post("*/api/orpc/site-auth/rpc/me", () => ok(ACCOUNT_ME)),
  http.post("*/api/orpc/site-auth/rpc/passkeyList", () => ok({ status: "ok", data: [] })),

  // Account.
  http.post("*/api/orpc/account/rpc/myOrders", () => ok(ACCOUNT_ORDERS)),
  http.post("*/api/orpc/account/rpc/myAddresses", () => ok(ACCOUNT_ADDRESSES)),
  http.post("*/api/orpc/account/rpc/upsertAddress", () =>
    ok({ status: "ok", data: ACCOUNT_ADDRESSES.data[0] })
  ),
  http.post("*/api/orpc/account/rpc/deleteAddress", () => ok({ status: "ok" })),

  // Catchall: any other oRPC endpoint resolves to a generic success so a
  // forgotten procedure never crashes a story.
  http.post("*/api/orpc/*", () => ok({ status: "ok", data: {} })),
  http.get("*/api/orpc/*", () => ok({ status: "ok", data: {} })),
];
