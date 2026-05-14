import { expect, type Page } from "@playwright/test";

/**
 * Shared login flow — drives the public /login form once per Playwright
 * worker (see the `workerStorageState` fixture in fixtures.ts).
 *
 * Why this lives in its own module: it used to be a `setup` *project*
 * (`auth.setup.ts`) that logged in ONCE per CI run and persisted a single
 * `storageState` shared by every authed project. That single session
 * token, replayed by N parallel workers against production, raced the
 * server's session rotation — some workers silently lost their session
 * and got bounced to /login. Authed specs that only *scan* a page (axe,
 * layout-integrity) then passed vacuously against the login page; only
 * skip-link, which asserts an authed-only element, caught it.
 *
 * The golden-2026 Playwright pattern ("one account per parallel worker")
 * gives every worker its own session — no shared token, no rotation race.
 * This module is the reusable login step that fixture calls.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

/**
 * Logs `page` into the intranet using E2E_USER / E2E_PASS.
 *
 * @returns `true` on success; `false` when the API is unreachable
 *          (preview-only run, fork PR without secrets) so the caller can
 *          fall back to an unauthenticated state and let `authedPage`
 *          skip the authed specs cleanly. Throws on a real login failure
 *          (wrong credentials, broken form) — that must fail loudly.
 */
export async function performLogin(page: Page): Promise<boolean> {
  const user = process.env.E2E_USER;
  const pass = process.env.E2E_PASS;
  if (!user || !pass) return false;

  // Probe the API. If unreachable (preview-only run, fork PR with no
  // secrets) bail out — the caller treats this as "no auth available".
  const csrf = await page.request
    .get(`${BASE_URL}/api/csrf`, { failOnStatusCode: false, timeout: 5_000 })
    .catch(() => undefined);
  if (!csrf || csrf.status() >= 500) return false;

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");

  // Wait for React hydration: the H1 always renders, but the HeroUI Button
  // children mount slightly after first paint. count() before hydration
  // returns 0 even though the button is about to appear.
  await page.getByRole("heading", { name: /inicia sesi[oó]n/i }).waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page
    .getByRole("button", { name: /ingresar con biometr/i })
    .or(page.locator('input[type="email"], input[autocomplete="username"]').first())
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  // Click "Usar correo y contraseña" if the passkey CTA is the default.
  // HeroUI v3 Button (React Aria) sometimes swallows the first synthetic
  // click in CI Chromium. Poll the state-machine transition (header text
  // changes from "Usa tu biometría" → "Ingresa tus credenciales") and
  // retry the click if it didn't take.
  const fallback = page.getByRole("button", {
    name: /usar correo( electr[oó]nico)? y contrase[ñn]a/i,
  });
  const credentialsHeader = page.getByText(/ingresa tus credenciales/i);
  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  const passInput = page.locator('input[type="password"]').first();

  if (await fallback.count()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await fallback.first().click({ force: true });
      try {
        await credentialsHeader.waitFor({ state: "visible", timeout: 4_000 });
        break;
      } catch {
        // Swallowed click — passkey button still mounted, retry.
      }
    }
  }
  await emailInput.waitFor({ state: "visible", timeout: 10_000 });
  await emailInput.fill(user);
  await passInput.fill(pass);
  await page
    .getByRole("button", { name: /^(iniciar sesi[oó]n|ingresar|continuar|log in)/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  // Sanity: a session cookie is now set.
  const cookies = await page.context().cookies();
  expect(cookies.length, "auth cookie set after login").toBeGreaterThan(0);

  return true;
}
