import { expect, test as setup } from "@playwright/test";

/**
 * Login once at the start of the run + persist the cookie/storage state to
 * disk. Every other authed project depends on this setup project (see
 * playwright.config.ts) and starts with the cookie pre-loaded, skipping
 * the login form entirely.
 *
 * Why: hammering the live auth endpoint 14+ times in parallel (every
 * authed a11y route × every project) gets us 429 Too Many Requests. The
 * golden 2026 Playwright pattern (since 1.39) is a `setup` project +
 * `storageState`. One real login per CI run, near-zero auth server load.
 */
export const authFile = "playwright/.auth/user.json";

const E2E_USER = process.env.E2E_USER;
const E2E_PASS = process.env.E2E_PASS;

setup("authenticate once + persist storageState", async ({ page, baseURL }) => {
  setup.skip(!E2E_USER || !E2E_PASS, "E2E_USER / E2E_PASS not set");

  // Probe the API. If unreachable (preview-only run, fork PR with no
  // secrets) skip the entire authed matrix.
  const csrf = await page.request
    .get(`${baseURL ?? ""}/api/csrf`, { failOnStatusCode: false, timeout: 5_000 })
    .catch(() => undefined);
  setup.skip(
    !csrf || csrf.status() >= 500,
    `API unavailable at ${baseURL}/api/csrf (status ${csrf?.status() ?? "no-response"})`
  );

  await page.goto("/login", { waitUntil: "domcontentloaded" });
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
  // setup.skip at the top of the test guarantees both env vars are set.
  if (!E2E_USER || !E2E_PASS) throw new Error("unreachable: setup.skip gate");
  await emailInput.fill(E2E_USER);
  await passInput.fill(E2E_PASS);
  await page
    .getByRole("button", { name: /^(iniciar sesi[oó]n|ingresar|continuar|log in)/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  // Sanity: cookie present.
  const cookies = await page.context().cookies();
  expect(cookies.length, "auth cookie set").toBeGreaterThan(0);

  await page.context().storageState({ path: authFile });
});
