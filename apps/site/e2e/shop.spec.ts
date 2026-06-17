import { expect, test } from "@playwright/test";

import { DEFAULT_PRODUCT_SLUG, installShopMocks, PRODUCTS } from "./_shop-mocks";

function nth<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`index ${i} out of bounds`);
  return v;
}

/**
 * Ecommerce (tienda) e2e — runs WITHOUT a backend. Every `/api/orpc/**` call is
 * intercepted by installShopMocks and answered with deterministic, contract-
 * accurate superjson fixtures (see _shop-mocks.ts). Runs on both viewport
 * projects (desktop + mobile) so the responsive surfaces are exercised.
 */

test.beforeEach(async ({ page }) => {
  await installShopMocks(page);
});

test("/tienda renders product cards with names and a product count", async ({ page }) => {
  await page.goto("/tienda", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: /Tienda Bioalergia/ })).toBeVisible();

  // Each mocked product surfaces its name.
  for (const p of PRODUCTS) {
    await expect(page.getByText(p.name, { exact: false }).first()).toBeVisible();
  }

  // The "<n> productos" counter reflects the mocked list length.
  await expect(page.getByText(`${PRODUCTS.length} productos`)).toBeVisible();
});

test("/tienda sort changes order and reflects in the URL", async ({ page }) => {
  await page.goto("/tienda", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(`${PRODUCTS.length} productos`)).toBeVisible();

  // Product titles are the Card.Title of each ProductCard; capture their order
  // by reading the visible product-name links (one per card → /producto/<slug>).
  const productLinks = page.locator('a[href^="/producto/"]');
  // Two links per card (image + "Ver producto"), so de-dupe via the title text.
  const firstNameBefore = nth(PRODUCTS, 0).name; // "relevancia" → Crema first
  await expect(page.getByRole("heading", { level: 3, name: firstNameBefore })).toBeVisible();

  // Pick "Precio: mayor a menor" — reverses the (price-ascending) default so the
  // first card becomes the most expensive product, a deterministic order flip.
  await page.getByRole("button", { name: /Ordenar|Más relevantes/ }).first().click();
  await page.getByRole("option", { name: "Precio: mayor a menor" }).click();

  await expect(page).toHaveURL(/[?&]sort=precio_desc/);

  const mostExpensive = nth(
    [...PRODUCTS].sort((a, b) => b.price_clp - a.price_clp),
    0
  );
  // After re-sort the most-expensive product's card heading is the first one in
  // DOM order among the product card headings.
  const cardHeadings = page.getByRole("heading", { level: 3 });
  await expect(cardHeadings.first()).toHaveText(mostExpensive.name);

  // Sanity: links still present (grid re-rendered, not blanked).
  await expect(productLinks.first()).toBeVisible();
});

test("/producto/$slug renders the product name and price", async ({ page }) => {
  const target = nth(PRODUCTS, 0);
  await page.goto(`/producto/${target.slug}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: target.name })).toBeVisible();

  // CLP price formatted as e.g. "$8.990" (es-CL). Match the digits with the
  // thousands separator the page uses.
  const formatted = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(target.price_clp);
  await expect(page.getByText(formatted).first()).toBeVisible();
});

test("adding a product to the cart reflects on /carrito", async ({ page }) => {
  await page.goto(`/producto/${DEFAULT_PRODUCT_SLUG}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The add-to-cart CTA (desktop primary button). On mobile the same label also
  // exists in the sticky bar — first() picks whichever is in the layout.
  await page.getByRole("button", { name: /Agregar al carrito|^Agregar$/ }).first().click();

  // Success affordance appears (mock returns a populated cart).
  await expect(page.getByText(/Agregado al carrito/)).toBeVisible();

  // Cart page shows the mocked line item.
  await page.goto("/carrito", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Mi carrito" })).toBeVisible();
  await expect(page.getByText(nth(PRODUCTS, 0).name).first()).toBeVisible();
  // Checkout CTA is present (cart is non-empty).
  await expect(page.getByRole("link", { name: /Ir al checkout/ })).toBeVisible();
});

test("/checkout renders its contact + shipping form for a populated cart", async ({ page }) => {
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });

  // VITE_MERCADOPAGO_PUBLIC_KEY may be unset in the preview build; in that case
  // the page renders a "Falta VITE_MERCADOPAGO_PUBLIC_KEY" alert instead of the
  // form. Accept either: the route mounted and reacted to the (mocked) cart.
  const heading = page.getByRole("heading", { level: 1, name: "Checkout" });
  const missingKeyAlert = page.getByText(/Falta .*VITE_MERCADOPAGO_PUBLIC_KEY/);

  await expect(heading.or(missingKeyAlert).first()).toBeVisible();

  if (await heading.isVisible().catch(() => false)) {
    // Full form path: contact section + the email field render.
    await expect(page.getByText("1. Contacto")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByText("2. Envío")).toBeVisible();
  }
});
