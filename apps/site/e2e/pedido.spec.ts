import { expect, test } from "@playwright/test";

import { installAccountMocks, paidOrder } from "./_account-mocks";

/**
 * /pedido/$number — order confirmation. The route reads `?email=` and calls
 * `checkoutClient.status({ order_number, email })`
 * (packages/orpc-contracts/src/checkout.ts → `status`, output
 * checkoutStatusResponseSchema). We mock that lookup to a PAID order and to a
 * not-found (404) error, asserting the rendered summary vs. error state.
 *
 * The route requires a valid `?email=` (validateSearch with z.string().email());
 * without it the SPA wouldn't mount the page, so every nav supplies one.
 */

const ORDER_NUMBER = "BA-2026-0001";
const EMAIL = "cliente@bioalergia.cl";

test("a found order renders its status summary and total", async ({ page }) => {
  await installAccountMocks(page, { orderStatus: paidOrder(ORDER_NUMBER) });

  await page.goto(`/pedido/${ORDER_NUMBER}?email=${encodeURIComponent(EMAIL)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.getByRole("heading", { level: 1, name: `Pedido ${ORDER_NUMBER}` })
  ).toBeVisible();
  // Status line from the mocked PAID order.
  await expect(page.getByText(/Estado:\s*PAID/)).toBeVisible();
  // PAID confirmation alert.
  await expect(page.getByText(/¡Pago confirmado!/)).toBeVisible();
  // DTE folio echoed.
  await expect(page.getByText(/10042/)).toBeVisible();
});

test("a not-found order renders the error state", async ({ page }) => {
  await installAccountMocks(page, { orderStatus: "error" });

  await page.goto(`/pedido/NO-EXISTE?email=${encodeURIComponent(EMAIL)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { level: 1, name: "Pedido NO-EXISTE" })).toBeVisible();
  await expect(page.getByText("No se pudo cargar el pedido.")).toBeVisible();
});
