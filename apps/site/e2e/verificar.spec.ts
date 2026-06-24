import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installAccountMocks, VALID_PRESCRIPTION } from "./_account-mocks";

/**
 * /verificar/$code — PUBLIC document verification (security-relevant surface).
 *
 * Backend-free: the route calls `verificationClient.verify({ code, h })`
 * (packages/orpc-contracts/src/verification.ts → `verify`, output is the
 * discriminated `verifyDocumentResponseSchema`). We mock that proc to a VALID
 * document and to an INVALID/expired one and assert the rendered OUTCOME, not
 * internals. Runs on desktop + mobile.
 */

test("a valid code renders the authentic-document outcome with its details", async ({ page }) => {
  await installAccountMocks(page, { verification: VALID_PRESCRIPTION });

  await page.goto("/verificar/BA-2026-0042", { waitUntil: "domcontentloaded" });

  // Success heading + the document label the contract returned.
  await expect(page.getByRole("heading", { level: 1, name: "Documento auténtico" })).toBeVisible();
  await expect(page.getByText(VALID_PRESCRIPTION.documentLabel).first()).toBeVisible();
  // Doctor + privacy-masked patient projection surfaces.
  await expect(page.getByText(VALID_PRESCRIPTION.doctor.name).first()).toBeVisible();
  await expect(page.getByText(VALID_PRESCRIPTION.patientInitials).first()).toBeVisible();
  // Folio echoed back.
  await expect(page.getByText(VALID_PRESCRIPTION.folio ?? "").first()).toBeVisible();
  // PDF-integrity badge for an intact file.
  await expect(page.getByText(/coincide con el original/)).toBeVisible();
});

test("an invalid/expired code renders the not-found outcome", async ({ page }) => {
  await installAccountMocks(page, { verification: "invalid" });

  await page.goto("/verificar/NO-EXISTE-0000", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Documento inválido" })).toBeVisible();
  await expect(page.getByText(/no existe, fue anulado o el código no es correcto/)).toBeVisible();
  // The consulted code is echoed back for the user.
  await expect(page.getByText(/NO-EXISTE-0000/)).toBeVisible();
});

test("the valid verification view has no critical a11y violations", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1000, "desktop-only scan");
  await installAccountMocks(page, { verification: VALID_PRESCRIPTION });
  await page.goto("/verificar/BA-2026-0042", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  expect(critical, critical.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
