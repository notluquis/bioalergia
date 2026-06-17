import { expect, test } from "@playwright/test";
import superjson from "superjson";

/**
 * /buscar — client-side search over static marketing pages + education topics +
 * DB-backed news articles. The pages/topics are bundled (no API). We mock the
 * one network call (`site-content.listArticles`) to an empty, deterministic list
 * so the news section never depends on real data — every assertion below targets
 * the static page/topic results, which are computed entirely in the browser.
 */

test.beforeEach(async ({ page }) => {
  // Only `listArticles` is hit; return an empty article list deterministically.
  await page.route("**/api/orpc/**", async (route) => {
    const proc = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    if (proc === "listArticles") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(superjson.serialize({ data: [], status: "ok" })),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true }, meta: [] }),
    });
  });
});

test("an empty query shows the prompt, not results", async ({ page }) => {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Buscar" })).toBeVisible();
  await expect(page.getByText(/Escribe arriba para buscar/)).toBeVisible();
});

test("typing a known term surfaces an expected static-page result", async ({ page }) => {
  await page.goto("/buscar?q=inmunoterapia", { waitUntil: "domcontentloaded" });

  // The "Páginas" group renders and the Inmunoterapia static page card appears.
  // The result card title is an <h3> (distinct from the nav/footer <a> links).
  await expect(page.getByRole("heading", { level: 2, name: "Páginas" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Inmunoterapia", exact: true })
  ).toBeVisible();
  // And its card description (from the static page index) is shown.
  await expect(
    page.getByText("Vacunas para la alergia que modifican la respuesta del sistema inmune.")
  ).toBeVisible();
});

test("typing in the search field filters results live and updates the URL", async ({ page }) => {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Escribe arriba para buscar/)).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscar en el sitio" }).fill("equipo");

  // Debounced write-back lands the query in the URL.
  await expect(page).toHaveURL(/[?&]q=equipo/);
  // The Equipo static page surfaces.
  await expect(page.locator('a[href="/equipo"]').first()).toBeVisible();
});

test("a no-match query shows the empty state", async ({ page }) => {
  await page.goto("/buscar?q=zzzzqqqxnomatch", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Sin resultados", { exact: true })).toBeVisible();
  await expect(page.getByText(/No encontramos resultados para/)).toBeVisible();
});
