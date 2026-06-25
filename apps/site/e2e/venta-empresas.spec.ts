import { expect, test } from "@playwright/test";

import {
  installReactivosMocks,
  VITRINA_ALLERGEN_COMMON_NAME,
  VITRINA_ITEMS,
} from "./_reactivos-mocks";

/**
 * Venta a empresas (reactivos B2B) e2e — runs WITHOUT a backend. Every
 * `/api/orpc/**` call is intercepted by installReactivosMocks and answered with
 * deterministic, contract-accurate superjson fixtures (see _reactivos-mocks.ts).
 * Runs on both viewport projects (desktop + mobile) so the responsive surfaces
 * are exercised.
 */

test.beforeEach(async ({ page }) => {
  await installReactivosMocks(page);
});

test("/venta-empresas renders the vitrina with product names and the allergen", async ({
  page,
}) => {
  await page.goto("/venta-empresas", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { level: 1, name: /Reactivos y diagnóstico/ })
  ).toBeVisible();

  // Each mocked vitrina item surfaces its name (Card.Title).
  for (const item of VITRINA_ITEMS) {
    await expect(page.getByText(item.name, { exact: false }).first()).toBeVisible();
  }

  // The allergen commonName of the first card renders inside its allergen block.
  await expect(
    page.getByText(VITRINA_ALLERGEN_COMMON_NAME, { exact: false }).first()
  ).toBeVisible();
});

test("/venta-empresas does NOT leak any CLP price", async ({ page }) => {
  await page.goto("/venta-empresas", { waitUntil: "domcontentloaded" });

  // Wait for the vitrina to actually render so the assertion runs against the
  // populated page, not an empty/loading shell.
  const firstItem = VITRINA_ITEMS[0];
  if (!firstItem) throw new Error("VITRINA_ITEMS fixture is empty");
  await expect(page.getByText(firstItem.name, { exact: false }).first()).toBeVisible();

  // The vitrina DTO carries NO price field — guard against a regression that
  // would surface a currency-looking number ("$8.990", "$ 12990", etc.).
  await expect(page.locator("body")).not.toContainText(/\$\s?\d/);
});

test("/venta-empresas lead form submits and shows the thank-you state", async ({ page }) => {
  await page.goto("/venta-empresas", { waitUntil: "domcontentloaded" });

  // Click the hero CTA to scroll to the form section (also confirms the CTA).
  await page.getByRole("button", { name: "Quiero cotizar" }).click();

  // The form card heading confirms we reached the lead form.
  await expect(page.getByRole("heading", { name: "Quiero cotizar" })).toBeVisible();

  // Required fields (HeroUI TextField → <Label> ties the accessible name).
  await page.getByLabel("Empresa o clínica").fill("Clínica Demo SpA");
  await page.getByLabel("Nombre de contacto").fill("Dra. Pérez");
  await page.getByLabel("Email").fill("contacto@clinica-demo.cl");

  // Optionally tick a product-of-interest checkbox (rendered from the vitrina).
  // The checkbox lives in a `max-h-60 overflow-y-auto` scroll container and, on
  // mobile, a fixed sticky bar overlaps the area — both intercept the pointer
  // hit-test even though the control is visible. A plain forced click on the
  // React Aria pressable toggles `isSelected` without `.check()`'s state-change
  // re-verification (which races the overlay on mobile). The product-of-interest
  // is optional, so the submit path does not depend on it succeeding.
  const firstItem = VITRINA_ITEMS[0];
  if (!firstItem) throw new Error("VITRINA_ITEMS fixture is empty");
  await page.getByRole("checkbox", { name: firstItem.name }).click({ force: true });

  // We deliberately do NOT touch the hidden honeypot `website` field.

  await page.getByRole("button", { name: "Enviar solicitud" }).click();

  // Success state from the route renders (createLead mock returns { ok, id }).
  await expect(page.getByRole("heading", { name: /¡Gracias! Te contactaremos/ })).toBeVisible();
  await expect(page.getByText(/Recibimos tu solicitud de reactivos/)).toBeVisible();
});
