import { expect, test } from "@playwright/test";

/**
 * Smoke suite for the public marketing site.
 *
 * Goal: catch broken routes / nav / blank pages early. Each static route
 * must return a non-error status AND render its expected level-1 heading
 * (proves the SPA actually mounted the route component, not just a shell).
 */

// Static content routes → a substring of their <h1>. The homepage hero h1 is
// the editorial headline — match on a stable substring.
const ROUTE_HEADINGS: ReadonlyArray<{ path: string; heading: RegExp }> = [
  { path: "/", heading: /Vuelve a respirar/ },
  { path: "/servicios", heading: /^Nuestros servicios$/ },
  { path: "/examenes", heading: /^Exámenes y estudios de alergia$/ },
  { path: "/inmunoterapia", heading: /^Inmunoterapia para alergias$/ },
  { path: "/botiquin", heading: /^Botiquín del alérgico$/ },
  { path: "/polen", heading: /^Niveles de polen en Chile$/ },
  { path: "/aprende", heading: /^Aprende sobre alergias$/ },
  { path: "/equipo", heading: /^Nuestro equipo$/ },
  { path: "/eres-alergico", heading: /Haz tu autoevaluación/ },
  { path: "/compromiso-social", heading: /^Compromiso social$/ },
  { path: "/noticias", heading: /^Noticias y educación en alergias$/ },
];

for (const { path, heading } of ROUTE_HEADINGS) {
  test(`route ${path} loads with a 2xx response and renders its h1`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    // The SPA is served statically; the document request itself should be 2xx.
    expect(response, `no response for ${path}`).not.toBeNull();
    expect(response?.status(), `bad status for ${path}`).toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("home page exposes the primary navigation", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toBeVisible();
  // Spot-check direct top-level links (Equipo/Aprende now live inside the
  // "Sobre nosotros" / "Recursos" dropdowns, so they're not direct links).
  for (const label of ["Servicios", "Exámenes", "Inmunoterapia"]) {
    await expect(nav.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
  }
  // The grouping dropdowns expose their triggers as buttons.
  for (const group of ["Sobre nosotros", "Recursos"]) {
    await expect(nav.getByRole("button", { name: group, exact: true })).toBeVisible();
  }
});

// The account surface is auth-gated: visiting /mi-cuenta unauthenticated
// redirects to /login (no marketing h1), so it's excluded from the h1 check.
// We still verify it doesn't hard-404.
const AUTH_GATED_NAV_PREFIXES = ["/mi-cuenta"] as const;

test("primary nav links all point to routes that load (no 404)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: "Navegación principal" });

  // Collect the in-app (same-origin, non-anchor) hrefs the nav exposes.
  const hrefs = await nav.getByRole("link").evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute("href"))
      .filter((h): h is string => Boolean(h))
      // Drop hash/anchor links (e.g. /#contacto) — those scroll, not navigate.
      .filter((h) => h.startsWith("/") && !h.includes("#"))
  );

  // Dedupe — the nav renders both a desktop and a mobile copy of the links, so
  // each href appears twice. Visiting each once keeps the preview server from
  // being hammered (the source of past flakes).
  const uniqueHrefs = [...new Set(hrefs)];

  // Sanity: the nav should expose several routable links.
  expect(uniqueHrefs.length).toBeGreaterThan(3);

  for (const href of uniqueHrefs) {
    const response = await page.goto(href, { waitUntil: "domcontentloaded" });
    // No hard error status for any nav target (SPA serves index.html → 2xx).
    expect(response?.status(), `nav link ${href} returned an error status`).toBeLessThan(400);

    // Auth-gated routes redirect to /login when unauthenticated — they have no
    // public marketing h1, so only assert they resolved (above), not the h1.
    if (AUTH_GATED_NAV_PREFIXES.some((p) => href.startsWith(p))) {
      continue;
    }
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
      `nav link ${href} rendered no h1 (possible broken route)`
    ).toBeVisible();
  }
});

test("/aprende shows topic cards and a card opens a topic page with content", async ({ page }) => {
  await page.goto("/aprende", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /^Aprende sobre alergias$/ })
  ).toBeVisible();

  // Topic cards are <a href="/aprende/<slug>"> wrapping a Card. Find them by
  // the link href pattern so the assertion doesn't depend on specific copy.
  const topicLinks = page.locator('a[href^="/aprende/"]');
  await expect(topicLinks.first()).toBeVisible();
  const count = await topicLinks.count();
  expect(count, "no topic cards rendered on /aprende").toBeGreaterThan(0);

  // Open the first topic and assert a real topic page rendered (its own h1 +
  // the "back to Aprende" affordance), not the "Tema no encontrado" fallback.
  await topicLinks.first().click();
  await expect(page).toHaveURL(/\/aprende\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Tema no encontrado");
  await expect(page.getByRole("link", { name: /Volver a Aprende/ })).toBeVisible();
});
