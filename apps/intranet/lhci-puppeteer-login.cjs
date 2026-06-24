"use strict";
/**
 * Lighthouse CI authentication scaffold (puppeteerScript).
 * Docs: github.com/GoogleChrome/lighthouse-ci → docs/configuration.md +
 * docs/recipes/puppeteer-example.js. LHCI keeps the browser open across all
 * URLs, so a cookie set here (the PASETO session) persists to later audits.
 *
 * ⚠️ NOT ENABLED YET. Auditing authed routes means navigating real PRODUCTION
 * patient pages (this project has NO staging DB) and Lighthouse reports embed
 * screenshots/DOM → PHI. Before wiring authed URLs into a lighthouserc:
 *   1. Use a dedicated READ-ONLY synthetic user (the E2EReadOnly role), via
 *      LHCI_USER / LHCI_PASS GitHub secrets — never a clinician account.
 *   2. Set `upload.target: "filesystem"` (private CI artifact), NOT
 *      "temporary-public-storage" (that publishes PHI to a public URL).
 *   3. Ideally point at a seeded staging env with synthetic data only.
 *   4. Gate to non-PR / manual runs.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {{url: string, options: object}} context
 */
module.exports = async (browser, context) => {
  // Public routes need no auth.
  if (context.url.endsWith("/login")) {
    return;
  }
  const page = await browser.newPage();
  const base = new URL(context.url).origin;
  await page.goto(`${base}/login`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', process.env.LHCI_USER ?? "");
  await page.type('input[name="password"]', process.env.LHCI_PASS ?? "");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);
  // PASETO cookie now lives in the shared browser profile → persists to the
  // authed audits. Close this tab so the audit gets a fresh page.
  await page.close();
};
