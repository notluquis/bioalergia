import { expect, test } from "@playwright/test";

/**
 * Bioalergia ships in Spanish only. Stray English copy ends up in screen-
 * reader output and confuses operators. This test scrapes the rendered DOM
 * for common English action verbs that should never appear in Spanish UI.
 *
 * The banned list is intentionally short — Spanish + English share many
 * cognates ("error", "dashboard", "logo", "PDF") so we only target verbs
 * that DON'T overlap. Add to BANNED when you spot a regression.
 */
const BANNED = [
  "submit",
  "loading",
  "save",
  "cancel",
  "delete",
  "search",
  "next",
  "previous",
  "close",
  "open",
  "edit",
  "remove",
] as const;

test("/login renders no English action verbs", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const text = (await page.locator("body").innerText()).toLowerCase();
  const hits = BANNED.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  expect.soft(hits, `English leaks: ${hits.join(", ")}`).toEqual([]);
});
