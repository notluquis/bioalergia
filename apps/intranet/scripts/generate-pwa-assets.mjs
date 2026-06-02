// Generates PWA manifest assets that need real rendering (no image editor):
//   - icon-maskable-512.png : opaque, full-bleed maskable icon. Logo sits
//     inside the centered safe circle (web.dev/maskable-icon: critical content
//     within radius = 40% of width → diameter 80%). We use 72% width so a wide
//     wordmark's ends stay inside the inscribed circle on circular masks.
//
// Run: node apps/intranet/scripts/generate-pwa-assets.mjs
// Requires Playwright Chromium (already a devDep via @playwright/test).
//
// NOTE: the brand logo is a WIDE wordmark; the ideal maskable is the molecule
// mark alone, centered large — a design TODO. This produces a spec-compliant,
// crop-safe icon from the existing asset in the meantime.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
const srcIcon = resolve(publicDir, "icons/icon-512.png");
const dataUri = `data:image/png;base64,${readFileSync(srcIcon).toString("base64")}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  // White full-bleed (the brand surface — the logo lives on white); logo at 72%
  // centered so it stays within the safe circle under any adaptive mask.
  await page.setContent(
    `<!doctype html><html><body style="margin:0">
       <div style="width:512px;height:512px;background:#ffffff;display:flex;align-items:center;justify-content:center">
         <img src="${dataUri}" style="width:72%;height:72%;object-fit:contain" />
       </div>
     </body></html>`,
    { waitUntil: "networkidle" }
  );
  await page.locator("img").waitFor({ state: "visible" });
  const out = resolve(publicDir, "icons/icon-maskable-512.png");
  await page.locator("div").screenshot({ path: out });
  // eslint-disable-next-line no-console
  console.log(`wrote ${out}`);

  // Optional manifest screenshots (richer install UI). Captures the PUBLIC
  // login page (no PHI) at the two required form factors. Set SCREENSHOT_URL
  // to a running app (e.g. http://localhost:5173/login).
  const screenshotUrl = process.env.SCREENSHOT_URL;
  if (screenshotUrl) {
    const shots = [
      { name: "screenshot-narrow.png", width: 1080, height: 1920 },
      { name: "screenshot-wide.png", width: 1920, height: 1080 },
    ];
    for (const s of shots) {
      const p = await browser.newPage({ viewport: { width: s.width, height: s.height } });
      await p.goto(screenshotUrl, { waitUntil: "networkidle", timeout: 30_000 });
      // Hide dev-only overlays (TanStack router/query devtools) so they don't
      // leak into the store screenshot when captured from the dev server.
      await p.addStyleTag({
        content: `[class*="Devtools"],[class*="devtools"],[id*="devtools"],
          .tsqd-parent-container,.TanStackRouterDevtools,
          button[aria-label*="TanStack"],button[aria-label*="devtools"]{display:none!important}`,
      });
      // settle any login-form skeleton
      await p.waitForTimeout(1500);
      const out2 = resolve(publicDir, `screenshots/${s.name}`);
      await p.screenshot({ path: out2 });
      await p.close();
      // eslint-disable-next-line no-console
      console.log(`wrote ${out2}`);
    }
  }
} finally {
  await browser.close();
}
