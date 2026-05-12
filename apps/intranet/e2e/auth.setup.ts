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

  // Click "Usar correo y contraseña" if the passkey CTA is the default.
  // Match both pre/post aria-label variants — Railway may lag a deploy.
  const fallback = page.getByRole("button", {
    name: /usar correo( electr[oó]nico)? y contrase[ñn]a/i,
  });
  if (await fallback.count()) {
    await fallback.click().catch(() => undefined);
  }

  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10_000 });
  await emailInput.fill(E2E_USER!);
  await passInput.fill(E2E_PASS!);
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
