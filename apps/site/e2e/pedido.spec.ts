import { expect, test } from "@playwright/test";

import type { OrderStatus } from "./_account-mocks";
import { installAccountMocks, orderStatusResponse, paidOrder } from "./_account-mocks";

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
  // Status block from the mocked PAID order (editorial: "Estado del pedido" label
  // + the friendly Spanish status value; the raw PAID enum is intentionally hidden
  // from buyers via STATUS_META).
  await expect(page.getByText("Estado del pedido")).toBeVisible();
  await expect(page.getByText("Pago confirmado", { exact: true })).toBeVisible();
  // PAID confirmation alert.
  await expect(page.getByText(/¡Pago confirmado!/)).toBeVisible();
  // DTE folio echoed.
  await expect(page.getByText(/10042/)).toBeVisible();
});

// Every raw status enum must render as its friendly Spanish help text (STATUS_META
// in routes/pedido/$number.tsx) — buyers never see the uppercase enum. `label` and
// `help` mirror that map; for FULFILLED/DELIVERED/CANCELLED/REFUNDED they coincide.
const STATUS_CASES: ReadonlyArray<{ status: OrderStatus; label: string; help: string }> = [
  { status: "PENDING", label: "Esperando pago", help: "Esperando confirmación de pago" },
  { status: "PAID", label: "Pago confirmado", help: "Pago confirmado, preparando tu pedido" },
  { status: "FULFILLED", label: "Despachado", help: "Despachado" },
  { status: "DELIVERED", label: "Entregado", help: "Entregado" },
  { status: "CANCELLED", label: "Cancelado", help: "Cancelado" },
  { status: "REFUNDED", label: "Reembolsado", help: "Reembolsado" },
];

for (const { status, label, help } of STATUS_CASES) {
  test(`status ${status} renders the friendly Spanish label, not the raw enum`, async ({ page }) => {
    await installAccountMocks(page, {
      orderStatus: orderStatusResponse(ORDER_NUMBER, { status }),
    });

    await page.goto(`/pedido/${ORDER_NUMBER}?email=${encodeURIComponent(EMAIL)}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", { level: 1, name: `Pedido ${ORDER_NUMBER}` })
    ).toBeVisible();
    await expect(page.getByText("Estado del pedido")).toBeVisible();
    // Friendly title + help copy from STATUS_META (first() because label === help
    // for the terminal states, so the string appears twice).
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(help, { exact: true }).first()).toBeVisible();
    // The raw uppercase enum must never leak into the buyer-facing page.
    await expect(page.getByText(status, { exact: true })).toHaveCount(0);
  });
}

test("shows the Chilexpress tracking number when the order carries an OT", async ({ page }) => {
  await installAccountMocks(page, {
    orderStatus: orderStatusResponse(ORDER_NUMBER, {
      status: "FULFILLED",
      cx_ot_number: "CX-778899",
    }),
  });

  await page.goto(`/pedido/${ORDER_NUMBER}?email=${encodeURIComponent(EMAIL)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByText("Seguimiento Chilexpress")).toBeVisible();
  // The OT number is the link to Chilexpress's public tracking portal.
  await expect(page.getByRole("link", { name: "CX-778899" })).toBeVisible();
});

test("shows the boleta download link when the order has a DTE PDF url", async ({ page }) => {
  await installAccountMocks(page, {
    orderStatus: orderStatusResponse(ORDER_NUMBER, {
      status: "DELIVERED",
      dte_pdf_url: "https://cdn.bioalergia.cl/dte/boleta-10042.pdf",
    }),
  });

  await page.goto(`/pedido/${ORDER_NUMBER}?email=${encodeURIComponent(EMAIL)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("link", { name: "Descargar boleta/factura" })).toBeVisible();
});

test("a not-found order renders the error state", async ({ page }) => {
  await installAccountMocks(page, { orderStatus: "error" });

  await page.goto(`/pedido/NO-EXISTE?email=${encodeURIComponent(EMAIL)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { level: 1, name: "Pedido NO-EXISTE" })).toBeVisible();
  await expect(page.getByText("No se pudo cargar el pedido.")).toBeVisible();
});
