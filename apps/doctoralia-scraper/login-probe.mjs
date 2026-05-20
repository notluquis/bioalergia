// Probe diagnóstico del auto-login Doctoralia (headed, lo ves correr).
// NO toca la API ni cookies remotas — solo loguea y reporta qué pasa.
//
// Correr local desde apps/doctoralia-scraper:
//   DOCTORALIA_SCRAPER_EMAIL='...' DOCTORALIA_SCRAPER_PASSWORD='...' node login-probe.mjs
//   HEADLESS=1 ...  (para simular cómo corre en Railway)

import { chromium } from "playwright";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const EMAIL = process.env.DOCTORALIA_SCRAPER_EMAIL;
const PASS = process.env.DOCTORALIA_SCRAPER_PASSWORD;
const HEADLESS = process.env.HEADLESS === "1";
const LOGIN_URL = "https://l.doctoralia.cl/";

if (!EMAIL || !PASS) {
  console.error("Faltan DOCTORALIA_SCRAPER_EMAIL / DOCTORALIA_SCRAPER_PASSWORD");
  process.exit(1);
}

const log = (...a) => console.log("[probe]", ...a);

const browser = await chromium.launch({
  headless: HEADLESS,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
  ],
});

try {
  const context = await browser.newContext({
    locale: "es-CL",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  log(`modo: ${HEADLESS ? "headless" : "headed"} — navegando a`, LOGIN_URL);
  // FIX vs index.ts: domcontentloaded (networkidle nunca dispara en SPA con polling)
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Dump inputs visibles para diagnosticar selectores
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((i) => `${i.name || "?"}|${i.type}`)
  );
  log("inputs en página:", inputs.join(", ") || "(ninguno)");

  const emailSel = 'input[type="email"], input[name="email"], input[name="_username"]';
  const passSel = 'input[type="password"], input[name="password"], input[name="_password"]';
  const hasEmail = await page.locator(emailSel).count();
  log("¿campo email visible?", hasEmail > 0);
  if (hasEmail === 0) {
    log("⚠️ no encontré el form de login — ¿cambió el selector o hay pantalla intermedia?");
    log("URL actual:", page.url());
    await page.waitForTimeout(HEADLESS ? 0 : 15000);
    process.exit(0);
  }

  await page.fill(emailSel, EMAIL);
  await page.fill(passSel, PASS);

  // Friendly Captcha startMode "focus" → disparar focusin
  await page.evaluate(() => {
    document.querySelector("form")?.dispatchEvent(new Event("focusin", { bubbles: true }));
  });

  const FRC = ['[name="frc-captcha-response"]', '[name="frc-captcha-solution"]'];
  let frcSel = null;
  for (const sel of FRC) {
    const el = await page.waitForSelector(sel, { timeout: 10000, state: "attached" }).catch(() => null);
    if (el) {
      frcSel = sel;
      break;
    }
  }
  log("captcha input:", frcSel ?? "NO ENCONTRADO");

  if (frcSel) {
    log("esperando PoW Friendly Captcha (hasta 60s)...");
    const solved = await page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          return el && el.value !== "" && !el.value.startsWith(".");
        },
        frcSel,
        { timeout: 60000, polling: 500 }
      )
      .then(() => true)
      .catch(() => false);
    log("captcha resuelto:", solved);
  }

  log("submit + esperando redirect a panel...");
  const outcome = await Promise.race([
    page.waitForURL(/docplanner\.doctoralia\.cl/, { timeout: 30000 }).then(() => "panel"),
    page.click('button[type="submit"], input[type="submit"]').then(() => null),
    page.waitForTimeout(32000).then(() => "timeout"),
  ]).catch((e) => `error: ${String(e).slice(0, 100)}`);

  await page.waitForTimeout(3000);
  log("resultado redirect:", outcome, "| URL:", page.url());

  const cookies = await context.cookies();
  const names = cookies.map((c) => c.name);
  const mkpl = cookies.find((c) => c.name === "mkplAuth");
  log(`cookies (${cookies.length}):`, names.join(", "));
  log("mkplAuth presente:", Boolean(mkpl), mkpl ? `(len ${mkpl.value.length})` : "");

  if (mkpl) log("\n✅ AUTO-LOGIN OK — mkplAuth obtenido sin pegado manual");
  else log("\n❌ sin mkplAuth — el login no completó (ver pasos arriba)");

  if (!HEADLESS) {
    log("(browser abierto 20s para inspección)");
    await page.waitForTimeout(20000);
  }
} finally {
  await browser.close();
}
