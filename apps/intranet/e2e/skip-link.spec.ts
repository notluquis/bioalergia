import { expect } from "@playwright/test";
import { test } from "./fixtures";

/**
 * "Saltar al contenido principal" skip link is the WCAG 2.4.1 (Bypass
 * Blocks) primitive. Must:
 *   - exist (sr-only is fine, but DOM-present)
 *   - become visible on focus
 *   - move focus to <main id="main-content"> when activated
 *
 * Tested on the authed shell because that's where the link lives. Skipped
 * cleanly when the API is unreachable (same gating as authed a11y suite).
 */
test("skip link reveals on focus + jumps to main", async ({ authedPage }) => {
  await authedPage.goto("/", { waitUntil: "domcontentloaded" });
  await authedPage.waitForLoadState("load");

  // Focus the skip link by Tab from body.
  await authedPage.locator("body").click();
  await authedPage.keyboard.press("Tab");

  const skipLink = authedPage.getByRole("link", { name: /saltar al contenido principal/i });
  await expect(skipLink).toBeFocused();

  const isVisible = await skipLink.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1; // sr-only collapses to 1×1
  });
  expect(isVisible, "skip link must un-hide on focus").toBe(true);

  await skipLink.press("Enter");
  // After activation, the URL hash points at #main-content and focus
  // moves to that element (tabIndex=-1 makes it programmatically focusable).
  expect(authedPage.url()).toContain("#main-content");
});
