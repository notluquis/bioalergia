// Probe diagnóstico del auto-login Doctoralia (headed, lo ves correr).
// NO toca la API ni cookies remotas — solo loguea y reporta qué pasa.
//
// Correr local desde apps/doctoralia-scraper:
//   DOCTORALIA_SCRAPER_EMAIL='...' DOCTORALIA_SCRAPER_PASSWORD='...' node login-probe.mjs
//   HEADLESS=1 ...  (para simular cómo corre en Railway)

import { chromium, webkit, firefox } from "playwright";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const EMAIL = process.env.DOCTORALIA_SCRAPER_EMAIL;
const PASS = process.env.DOCTORALIA_SCRAPER_PASSWORD;
const HEADLESS = process.env.HEADLESS === "1";
const ENGINE = (process.env.BROWSER ?? "chromium").toLowerCase();
// Entry real: docplanner redirige al SSO con client_id → login → vuelve directo
// al panel (sin pasar por el chooser /apps). Entrar a l.doctoralia.cl/ pelado
// (sin client_id) lleva a /apps.
const ENTRY_URL = "https://docplanner.doctoralia.cl/#/";

if (!EMAIL || !PASS) {
  console.error("Faltan DOCTORALIA_SCRAPER_EMAIL / DOCTORALIA_SCRAPER_PASSWORD");
  process.exit(1);
}

const log = (...a) => console.log(`[probe:${ENGINE}]`, ...a);

const engines = { chromium, webkit, firefox };
const launcher = engines[ENGINE];
if (!launcher) {
  console.error(`BROWSER inválido: ${ENGINE} (usá chromium|webkit|firefox)`);
  process.exit(1);
}

// Chromium-only flags; webkit/firefox los rechazan → solo para chromium.
const launchOpts = { headless: HEADLESS };
if (ENGINE === "chromium") {
  launchOpts.args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
  ];
}
const browser = await launcher.launch(launchOpts);

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

  log(`modo: ${HEADLESS ? "headless" : "headed"} — entry`, ENTRY_URL);
  await page.goto(ENTRY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  const emailSel = 'input[type="email"], input[name="email"], input[name="_username"]';
  const passSel = 'input[type="password"], input[name="password"], input[name="_password"]';

  // docplanner redirige al SSO (l.doctoralia.cl con client_id) — esperar el form
  await page.waitForSelector(emailSel, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log("URL tras redirect SSO:", page.url());

  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((i) => `${i.name || "?"}|${i.type}`)
  );
  log("inputs en página:", inputs.join(", ") || "(ninguno)");

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
    const el = await page
      .waitForSelector(sel, { timeout: 10000, state: "attached" })
      .catch(() => null);
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

  log("submit...");
  await page.click('button[type="submit"], input[type="submit"]').catch(() => {});

  // ─── Resolver loop: maneja interstitials hasta llegar al panel ────────────
  // Post-login Doctoralia mete pantallas en orden variable: /2fa (OTP email),
  // /weak-password ("Recuérdamelo más tarde"), /apps (elegir app). Iteramos
  // hasta docplanner panel o timeout.
  const codeInput = 'input[type="text"], input[name="code"], input[autocomplete="one-time-code"]';
  const deadline = Date.now() + 120_000;
  let lastUrl = "";
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);
    const url = page.url();
    if (url !== lastUrl) {
      log("URL:", url);
      lastUrl = url;
    }

    if (/docplanner\.doctoralia\.cl/.test(url)) {
      log("→ llegó al panel ✓");
      break;
    }
    if (url.includes("/2fa")) {
      const code = await fetchDoctoraliaOtp(Date.now());
      if (!code) {
        log("❌ sin OTP del correo");
        break;
      }
      log("OTP email:", code);
      await page.fill(codeInput, code).catch(() => {});
      await page.click('button[type="submit"], button:has-text("Enviar")').catch(() => {});
    } else if (url.includes("/weak-password")) {
      log('weak-password → "Recuérdamelo más tarde"');
      await page
        .click(
          'button:has-text("Recuérdamelo"), a:has-text("Recuérdamelo"), :text("Recuérdamelo más tarde")'
        )
        .catch(() => {});
    } else if (url.includes("/apps")) {
      log("/apps → www.doctoralia.cl");
      await page.click('a:has-text("doctoralia.cl"), :text("www.doctoralia.cl")').catch(() => {});
    }
  }

  const cookies = await context.cookies();
  const names = cookies.map((c) => c.name);
  const mkpl = cookies.find((c) => c.name === "mkplAuth");
  log(`cookies (${cookies.length}):`, names.join(", "));
  log("mkplAuth presente:", Boolean(mkpl), mkpl ? `(len ${mkpl.value.length})` : "");

  if (mkpl) log("\n✅ AUTO-LOGIN OK — mkplAuth obtenido sin pegado manual");
  else log("\n❌ sin mkplAuth — el login no completó (ver pasos arriba)");

  if (!HEADLESS) {
    log("(browser abierto 20s para inspección)");
    await page.waitForTimeout(20000).catch(() => {});
  }
} finally {
  await browser.close();
}

// Lee el OTP de Doctoralia del inbox vía IMAP. Poll ~60s (el mail llega en seg).
// El código va en <strong>NNNNNN</strong>. From noreply@doctoralia.cl.
async function fetchDoctoraliaOtp(sinceMs) {
  const { ImapFlow } = await import("imapflow");
  const host = process.env.DOCTORALIA_SCRAPER_IMAP_HOST ?? "mail.spacemail.com";
  const user = process.env.DOCTORALIA_SCRAPER_IMAP_USER ?? EMAIL;
  const pass = process.env.DOCTORALIA_SCRAPER_IMAP_PASS ?? PASS;

  log(`IMAP connect host=${host} user=${user}`);
  const client = new ImapFlow({
    auth: { pass, user },
    host,
    logger: false,
    port: 993,
    secure: true,
  });
  await client.connect();
  log("IMAP conectado");
  try {
    for (let attempt = 0; attempt < 12; attempt++) {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const status = client.mailbox;
        const total = status?.exists ?? 0;
        // últimos 30 por seq
        const from = Math.max(1, total - 29);
        let newestCode = null;
        const seen = [];
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, source: true })) {
          const subj = msg.envelope?.subject ?? "";
          const fromAddr = msg.envelope?.from?.[0]?.address ?? "";
          seen.push(`${fromAddr} | ${subj}`);
          if (!/doctoralia/i.test(fromAddr) || !/verificaci/i.test(subj)) continue;
          const m = msg.source?.toString("utf8").match(/<strong>\s*(\d{6})\s*<\/strong>/);
          if (m) newestCode = m[1]; // se queda con el último del fetch (más reciente)
        }
        if (attempt === 0) {
          log(`INBOX exists=${total}, últimos ${seen.length}:`);
          for (const s of seen.slice(-8)) log("   •", s);
        }
        if (newestCode) return newestCode;
      } finally {
        lock.release();
      }
      log(`OTP no encontrado, reintento ${attempt + 1}/12...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
    return null;
  } finally {
    await client.logout().catch(() => {});
  }
}
