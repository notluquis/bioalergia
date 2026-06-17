import { expect, test } from "@playwright/test";

import { installAccountMocks } from "./_account-mocks";

/**
 * Auth surfaces for the public shop account. Mutation-free: we never submit a
 * real login/register — we assert the forms render + client validation, and
 * that the auth-gated /mi-cuenta redirects to /login when the session probe
 * (`site-auth.me`) reports no user.
 */

test("/login renders the email + password form", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel(/Contraseña/)).toBeVisible();
  // The CTA defaults to the magic-link label until a password is typed.
  await expect(page.getByRole("button", { name: "Enviarme un enlace mágico" })).toBeVisible();
  // Link to the registration page is present.
  await expect(page.getByRole("link", { name: "Regístrate" })).toBeVisible();
});

test("/login keeps its submit disabled until a valid email is entered", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const submit = page.getByRole("button", { name: "Enviarme un enlace mágico" });
  // canSubmit requires email.includes("@") → disabled initially.
  await expect(submit).toBeDisabled();

  await page.getByLabel("Email").fill("cliente@bioalergia.cl");
  await expect(submit).toBeEnabled();
});

test("/registro renders the account-creation form", async ({ page }) => {
  await page.goto("/registro", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Crear cuenta" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toBeVisible();
  await expect(page.getByLabel(/RUT/)).toBeVisible();
  // Terms checkbox gates submission.
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.getByRole("link", { name: "Inicia sesión" })).toBeVisible();
});

test("/mi-cuenta redirects to /login when unauthenticated", async ({ page }) => {
  await installAccountMocks(page, { session: "anon" });

  await page.goto("/mi-cuenta", { waitUntil: "domcontentloaded" });

  // The layout's guard navigates to /login once `me` resolves with no user.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
});
