import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Impit, type HttpMethod } from "impit";
import { loadConfig, type ScraperConfig } from "./config.ts";
import { CookieJar } from "./cookies.ts";
import { type CapturedEntry, postToImportEndpoint } from "./submit.ts";
import {
  forcedCurrentWeekWindow,
  getTickDebugInfo,
  selectWindowsForTick,
  type WindowRequest,
} from "./window-selector.ts";

const discoverMode = process.argv.includes("--discover");

function log(...args: unknown[]): void {
  console.log("[doctoralia-scraper]", ...args);
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildLegacyWindows(anchor: Date, windowDays: number, count: number): WindowRequest[] {
  const base = new Date(anchor);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  const windows: WindowRequest[] = [];
  for (let i = 0; i < count; i++) {
    const from = new Date(base);
    from.setDate(from.getDate() + i * windowDays);
    const to = new Date(from);
    to.setDate(to.getDate() + windowDays - 1);
    windows.push({
      from: fmtDate(from),
      to: `${fmtDate(to)}T23:59:59`,
      tier: "W0",
    });
  }
  return windows;
}

function extractBearerFromJar(jar: CookieJar): string | null {
  const raw = jar.get("mkplAuth");
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  const match = decoded.match(/^bearer\s+(.+)$/i);
  return match ? match[1].trim() : decoded.trim();
}

const FRONT_VERSION_RE = /(?:one-front-version|fmaster_)[^"'\s]*\d+\.\d+/i;

function extractFrontVersion(html: string): string | null {
  const fmaster = html.match(/fmaster_\d+\.\d+/);
  if (fmaster) return fmaster[0];
  const attr = html.match(/data-front-version=["']([^"']+)["']/);
  if (attr) return attr[1];
  const generic = html.match(FRONT_VERSION_RE);
  return generic?.[0] ?? null;
}

type RunOverrideResult = {
  active: boolean;
  source: "db" | "none";
};

class ImpitSession {
  readonly impit: Impit;
  readonly jar: CookieJar;
  // NO parameter properties: Node 26 strip-types las rechaza (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
  constructor(jar: CookieJar) {
    this.jar = jar;
    this.impit = new Impit({ browser: "chrome", ignoreTlsErrors: false });
  }

  async request(
    url: string,
    init: {
      method?: HttpMethod;
      headers?: Record<string, string>;
      body?: string;
      redirect?: "follow" | "manual";
    } = {}
  ): Promise<{ status: number; url: string; headers: Headers; text: string }> {
    const headers: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
      ...init.headers,
    };
    const cookieHeader = this.jar.header();
    if (cookieHeader) headers.Cookie = cookieHeader;

    const res = await this.impit.fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      redirect: init.redirect ?? "follow",
    });

    const setCookie = extractSetCookies(res.headers);
    if (setCookie.length) this.jar.ingestSetCookie(setCookie);

    const text = await res.text();
    return { status: res.status, url: res.url ?? url, headers: res.headers, text };
  }
}

function extractSetCookies(headers: Headers): string[] {
  const fn = headers.getSetCookie?.bind(headers);
  if (typeof fn === "function") return fn();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

async function askStdin(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(prompt);
  rl.close();
  return answer.trim();
}

const LOGIN_URL = "https://l.doctoralia.cl/";
// Entry para el login por browser: docplanner redirige al SSO con client_id →
// tras login vuelve directo al panel (sin pasar por el chooser /apps).
const ENTRY_URL = "https://docplanner.doctoralia.cl/#/";
const SPA_SHELL_MARKER = /<div id="vuesaas">/i;

// Lee el OTP de 2FA de Doctoralia del inbox (mail.spacemail.com) vía IMAP.
// El código va en <strong>NNNNNN</strong>; from noreply@doctoralia.cl. Poll ~60s.
async function fetchDoctoraliaOtp(config: ScraperConfig): Promise<string | null> {
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    auth: { pass: config.imapPass, user: config.imapUser },
    host: config.imapHost,
    logger: false,
    port: 993,
    secure: true,
  });
  await client.connect();
  try {
    for (let attempt = 0; attempt < 12; attempt++) {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const total =
          client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0;
        const from = Math.max(1, total - 29);
        let code: null | string = null;
        for await (const msg of client.fetch(`${from}:*`, { envelope: true, source: true })) {
          const subj = msg.envelope?.subject ?? "";
          const fromAddr = msg.envelope?.from?.[0]?.address ?? "";
          if (!/doctoralia/i.test(fromAddr) || !/verificaci/i.test(subj)) continue;
          const m = msg.source?.toString("utf8").match(/<strong>\s*(\d{6})\s*<\/strong>/);
          if (m) code = m[1]; // último del fetch = más reciente
        }
        if (code) return code;
      } finally {
        lock.release();
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
    return null;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function performLoginWithBrowser(
  session: ImpitSession,
  config: ScraperConfig
): Promise<void> {
  // WebKit: más liviano que chromium y verificado 2026-05 que pasa el Friendly
  // Captcha de Doctoralia. La imagen Docker copia /ms-playwright completo (los 3
  // browsers) → webkit disponible sin instalar nada extra.
  log("switching to Playwright (webkit) browser-based login...");
  const { webkit } = await import("playwright");
  const browser = await webkit.launch({ headless: true });
  try {
    const context = await browser.newContext({ locale: "es-CL" });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();

    // Entry real: docplanner redirige al SSO con client_id → tras login vuelve
    // DIRECTO al panel. Entrar a l.doctoralia.cl/ pelado lleva al chooser /apps.
    log("  browser: entry", ENTRY_URL);
    await page.goto(ENTRY_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const emailSel = 'input[type="email"], input[name="email"], input[name="_username"]';
    const passSel = 'input[type="password"], input[name="password"], input[name="_password"]';
    await page.waitForSelector(emailSel, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1_500);
    log("  browser: SSO url", page.url());

    await page.fill(emailSel, config.email);
    await page.fill(passSel, config.password);

    // Friendly Captcha startMode "focus": disparar focusin para que arranque.
    await page.evaluate(() => {
      document.querySelector("form")?.dispatchEvent(new Event("focusin", { bubbles: true }));
    });

    // Esperar PoW del captcha (tolerante: no bloquea si no completa).
    const frcSelectors = ['[name="frc-captcha-response"]', '[name="frc-captcha-solution"]'];
    let frcSelector: null | string = null;
    for (const sel of frcSelectors) {
      const el = await page
        .waitForSelector(sel, { state: "attached", timeout: 15_000 })
        .catch(() => null);
      if (el) {
        frcSelector = sel;
        break;
      }
    }
    if (frcSelector) {
      const solved = await page
        .waitForFunction(
          (sel) => {
            const el = document.querySelector<HTMLInputElement>(sel);
            return Boolean(el && el.value !== "" && !el.value.startsWith("."));
          },
          frcSelector,
          { polling: 500, timeout: 20_000 }
        )
        .then(() => true)
        .catch(() => false);
      log(`  browser: captcha PoW ${solved ? "resuelto" : "no completó (no bloquea)"}`);
    }

    log("  browser: submit");
    await page.click('button[type="submit"], input[type="submit"]').catch(() => {});

    // Resolver loop: Doctoralia mete pantallas en orden variable post-login.
    const codeInput = 'input[type="text"], input[name="code"], input[autocomplete="one-time-code"]';
    const deadline = Date.now() + 120_000;
    let lastUrl = "";
    while (Date.now() < deadline) {
      await page.waitForTimeout(2_500);
      const url = page.url();
      if (url !== lastUrl) {
        log("  browser: url", url);
        lastUrl = url;
      }
      if (/docplanner\.doctoralia\.cl/.test(url)) {
        log("  browser: panel reached");
        break;
      }
      if (url.includes("/2fa")) {
        const code = await fetchDoctoraliaOtp(config);
        if (!code) {
          log("  browser: 2FA pero no encontré OTP en el correo");
          break;
        }
        log("  browser: OTP del correo obtenido");
        await page.fill(codeInput, code).catch(() => {});
        await page.click('button[type="submit"], button:has-text("Enviar")').catch(() => {});
      } else if (url.includes("/weak-password")) {
        await page
          .click(
            'button:has-text("Recuérdamelo"), a:has-text("Recuérdamelo"), :text("Recuérdamelo más tarde")'
          )
          .catch(() => {});
      } else if (url.includes("/apps")) {
        await page.click('a:has-text("doctoralia.cl"), :text("www.doctoralia.cl")').catch(() => {});
      }
    }

    const playwrightCookies = await context.cookies();
    session.jar.clear();
    for (const c of playwrightCookies) {
      const expiresMs = c.expires > 0 ? Math.floor(c.expires * 1000) : undefined;
      session.jar.setRaw(c.name, c.value, c.domain, c.path, expiresMs);
    }
    const hasAuth = playwrightCookies.some((c) => c.name === "mkplAuth");
    log(`  browser: extracted ${playwrightCookies.length} cookies (mkplAuth=${hasAuth})`);
    if (!hasAuth) {
      throw new Error("browser login terminó sin mkplAuth — login incompleto");
    }
  } finally {
    await browser.close();
  }
}

async function performLogin(session: ImpitSession, config: ScraperConfig): Promise<void> {
  log("not logged in — fetching login page at", LOGIN_URL);
  const loginPage = await session.request(LOGIN_URL);
  log(`  → ${loginPage.status} ${loginPage.url}`);

  if (discoverMode) {
    const snapshot = path.join(config.capturesDir, "login-page.html");
    fs.mkdirSync(config.capturesDir, { recursive: true });
    fs.writeFileSync(snapshot, loginPage.text, "utf8");
    log(
      `--discover: wrote login HTML (${loginPage.text.length} bytes) from ${loginPage.url} to ${snapshot}`
    );
    process.exit(0);
  }

  if (/data-form-field-captcha=/i.test(loginPage.text)) {
    log("⚠️ login form uses Friendly Captcha / reCAPTCHA — switching to browser-based login.");
    await performLoginWithBrowser(session, config);
    return;
  }

  const form = extractLoginForm(loginPage.text, loginPage.url);
  log("detected form:", {
    action: form.action,
    emailField: form.emailField,
    passwordField: form.passwordField,
    hiddenKeys: Object.keys(form.hidden),
  });

  const body = new URLSearchParams({
    ...form.hidden,
    [form.emailField]: config.email,
    [form.passwordField]: config.password,
  });

  log("POST", form.action);
  const loginRes = await session.request(form.action, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: loginPage.url,
      Origin: new URL(loginPage.url).origin,
    },
    body: body.toString(),
  });
  log(`  → ${loginRes.status} ${loginRes.url}`);

  // A 4xx on the POST means Doctoralia's WAF / Friendly Captcha rejected the
  // headless HTTP login (commonly 403, even when the login HTML carried no
  // captcha marker for the upfront check). The browser path solves the PoW
  // captcha, so fall back to it instead of returning as a false success.
  if (loginRes.status === 401 || loginRes.status === 403 || loginRes.status === 429) {
    log(`  HTTP login blocked (${loginRes.status}) — retrying via Playwright browser.`);
    await performLoginWithBrowser(session, config);
    return;
  }

  const bouncedToLogin = /l\.doctoralia\.cl/i.test(loginRes.url);
  if (bouncedToLogin) {
    const hasCaptchaInResponse = /data-form-field-captcha=/i.test(loginRes.text);
    if (hasCaptchaInResponse) {
      log("  HTTP login bounced with captcha — retrying via Playwright browser.");
      await performLoginWithBrowser(session, config);
      return;
    }

    const errorMatch = loginRes.text.match(
      /<div[^>]*(?:alert|error|flash)[^>]*>([\s\S]*?)<\/div>/i
    );
    if (errorMatch) {
      const msg = errorMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);
      log(`  server message: ${msg}`);
    }

    const responsePreview = loginRes.text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    log(`  bounced back to ${loginRes.url} — login failed or captcha blocked.`);
    if (responsePreview) {
      log(`  response preview: ${responsePreview}`);
    }

    throw new Error("login POST bounced back — Doctoralia rejected relogin or captcha blocked it");
  }

  if (/otp|verification_code/i.test(loginRes.text) && /input/i.test(loginRes.text)) {
    const code = await askStdin("OTP code sent to email? Enter it here: ");
    const otpForm = extractLoginForm(loginRes.text, loginRes.url);
    const otpField = Object.keys(otpForm.hidden).find((k) => /code|otp/i.test(k)) ?? "code";
    const otpBody = new URLSearchParams({ ...otpForm.hidden, [otpField]: code });
    log("POST OTP", otpForm.action);
    const otpRes = await session.request(otpForm.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: otpBody.toString(),
    });
    log(`  → ${otpRes.status} ${otpRes.url}`);
  }

  log(`cookies persisted: ${session.jar.size()}`);
}

async function ensureLoggedIn(
  session: ImpitSession,
  config: ScraperConfig,
  options?: { force?: boolean }
): Promise<void> {
  if (options?.force) {
    log("forcing Doctoralia relogin after auth failure");
    session.jar.clear();
    await performLogin(session, config);
    return;
  }

  log("GET", config.baseUrl);
  const initial = await session.request(config.baseUrl);
  log(`  → ${initial.status} ${initial.url}`);

  // The panel is a Vue SPA that renders client-side. Without JS, the server
  // always returns the shell. Detect "logged in" by poking an authenticated
  // endpoint: if the panel cookies are valid, the API accepts them.
  const isSpaShell = SPA_SHELL_MARKER.test(initial.text);
  // The calendar API authenticates with the `mkplAuth` bearer cookie. Any other
  // cookies (8+ analytics/session crumbs survive long after the bearer expires)
  // do NOT count — only mkplAuth makes the session usable. Checking jar.size()>0
  // gave a false "valid" and skipped relogin forever once mkplAuth dropped,
  // leaving the calendar sync 401-ing for days.
  const hasAuthCookie = Boolean(session.jar.get("mkplAuth"));

  if (!hasAuthCookie) {
    log("no mkplAuth cookie present — forcing relogin");
    await performLogin(session, config);
    return;
  }

  if (!isSpaShell && !/l\.doctoralia\.cl/i.test(initial.url)) {
    log("session reused — already inside panel");
    return;
  }

  if (isSpaShell) {
    log("got SPA shell with mkplAuth — assuming session still valid (calendar fetch will verify)");
    return;
  }

  await performLogin(session, config);
}

function extractLoginForm(
  html: string,
  pageUrl: string
): {
  action: string;
  hidden: Record<string, string>;
  emailField: string;
  passwordField: string;
} {
  const formMatch = html.match(/<form[^>]*>[\s\S]*?<\/form>/i);
  const formHtml = formMatch?.[0] ?? html;
  const actionMatch = formHtml.match(/<form[^>]*\baction=["']([^"']+)["']/i);
  const action = new URL(actionMatch?.[1] ?? pageUrl, pageUrl).toString();

  const hidden: Record<string, string> = {};
  for (const m of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const type = /\btype=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const name = /\bname=["']([^"']+)["']/i.exec(tag)?.[1];
    const value = /\bvalue=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    if (!name) continue;
    if (type === "hidden") hidden[name] = value;
  }

  const emailField =
    /<input[^>]*\bname=["']([^"']+)["'][^>]*\btype=["']email["']/i.exec(formHtml)?.[1] ??
    /<input[^>]*\btype=["']email["'][^>]*\bname=["']([^"']+)["']/i.exec(formHtml)?.[1] ??
    "email";
  const passwordField =
    /<input[^>]*\bname=["']([^"']+)["'][^>]*\btype=["']password["']/i.exec(formHtml)?.[1] ??
    /<input[^>]*\btype=["']password["'][^>]*\bname=["']([^"']+)["']/i.exec(formHtml)?.[1] ??
    "password";

  return { action, hidden, emailField, passwordField };
}

async function resolveFrontVersion(
  session: ImpitSession,
  config: ScraperConfig
): Promise<string | null> {
  try {
    const shell = await session.request(config.baseUrl);
    const scraped = extractFrontVersion(shell.text);
    if (scraped) {
      log(`detected x-one-front-version from shell: ${scraped}`);
      return scraped;
    }
  } catch (err) {
    log("failed to load SPA shell for front-version detection:", (err as Error).message);
  }
  if (config.frontVersionFallback) {
    log(`using DOCTORALIA_SCRAPER_FRONT_VERSION fallback: ${config.frontVersionFallback}`);
    return config.frontVersionFallback;
  }
  return null;
}

async function consumeRunOverride(config: ScraperConfig): Promise<RunOverrideResult> {
  const res = await fetch(config.runControlEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.cookiesApiToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[run-control] POST ${config.runControlEndpoint} → ${res.status}: ${body.slice(0, 200)}`
    );
  }

  const payload = (await res.json()) as { active?: boolean; source?: "db" | "none" };
  return {
    active: payload.active === true,
    source: payload.source === "db" ? "db" : "none",
  };
}

async function fetchCalendarEvents(
  session: ImpitSession,
  config: ScraperConfig,
  options?: { allowReloginRetry?: boolean }
): Promise<CapturedEntry[]> {
  const bearer = extractBearerFromJar(session.jar);
  if (!bearer) {
    throw new Error(
      "no mkplAuth cookie found — paste the Cookie header from Doctoralia DevTools in the intranet panel first"
    );
  }
  const frontVersion = await resolveFrontVersion(session, config);
  if (!frontVersion) {
    throw new Error(
      "could not detect x-one-front-version from SPA shell and no DOCTORALIA_SCRAPER_FRONT_VERSION fallback set"
    );
  }

  const endpoint = `${config.baseUrl}/api/calendarevents`;
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Authorization: `bearer ${bearer}`,
    Origin: config.baseUrl,
    Referer: `${config.baseUrl}/`,
    "x-one-front-version": frontVersion,
    "one-user-id": config.oneUserId,
    "x-user-type": config.userType,
    "x-country-id": config.countryId,
  };

  const useLegacy = process.env.DOCTORALIA_SCRAPER_FORCE_LEGACY_WINDOWS === "true";
  const tickDebug = getTickDebugInfo(new Date());
  const runOverride = await consumeRunOverride(config);
  let windows = useLegacy
    ? buildLegacyWindows(new Date(), config.windowDays, config.windowsPerRun)
    : selectWindowsForTick(new Date());

  if (!useLegacy && windows.length === 0 && runOverride.active) {
    windows = [forcedCurrentWeekWindow(new Date())];
    log("forcing scraper run outside business hours", {
      source: runOverride.source,
      windows: windows.map((w) => `${w.tier}:${w.from}→${w.to.slice(0, 10)}`),
    });
  }

  if (windows.length === 0) {
    log("no windows scheduled for this tick", tickDebug);
    return [];
  }

  log(
    `scheduled ${windows.length} window(s):`,
    windows.map((w) => `${w.tier}:${w.from}→${w.to.slice(0, 10)}`).join(" ")
  );

  const results: CapturedEntry[] = [];
  for (const { from, to, tier } of windows) {
    const body = JSON.stringify({ from, to, schedules: [] });
    log("POST", endpoint, `tier=${tier} from=${from} to=${to}`);
    const res = await session.request(endpoint, { method: "POST", headers, body });
    log(`  → ${res.status}`);
    if (res.status !== 200) {
      if (res.status === 401 || res.status === 403) {
        if (options?.allowReloginRetry !== false) {
          log(`  auth failed with ${res.status} — attempting relogin and one retry`);
          await ensureLoggedIn(session, config, { force: true });
          await session.jar.save();
          return fetchCalendarEvents(session, config, { allowReloginRetry: false });
        }
        throw new Error(
          `calendarevents ${res.status} after relogin — cookies expired, login blocked, or bearer invalid. Re-paste the Cookie header.`
        );
      }
      log(`  unexpected status, body preview: ${res.text.slice(0, 200)}`);
      continue;
    }
    try {
      const json = JSON.parse(res.text) as { appointments?: unknown[] };
      results.push({
        ts: new Date().toISOString(),
        src: `${endpoint}?from=${from}&to=${to}&tier=${tier}`,
        data: json,
      });
      const appts = Array.isArray(json.appointments) ? json.appointments.length : 0;
      log(`  captured ${appts} appointments (tier=${tier})`);
    } catch {
      log("  response not JSON, skipping");
    }
  }
  return results;
}

async function run(): Promise<void> {
  const config = loadConfig();
  const jar = new CookieJar({
    endpoint: config.cookiesEndpoint,
    apiToken: config.cookiesApiToken,
    label: config.cookiesLabel,
  });
  await jar.load();
  log(`loaded ${jar.size()} cookies from ${config.cookiesEndpoint} (label=${config.cookiesLabel})`);

  const session = new ImpitSession(jar);

  await ensureLoggedIn(session, config);
  await jar.save();

  const captured = await fetchCalendarEvents(session, config);
  await jar.save();

  if (captured.length === 0) {
    log(
      "no calendarevents captured. Try `pnpm --filter @finanzas/doctoralia-scraper discover` first to inspect the login page and find the real endpoint."
    );
    return;
  }

  if (config.importEndpoint) {
    log(`POST ${config.importEndpoint} (${captured.length} entries)`);
    const result = await postToImportEndpoint(config.importEndpoint, config.importToken, captured);
    log("import →", result.status, result.ok ? "OK" : "FAIL", result.body.slice(0, 400));
  } else {
    log("DOCTORALIA_SCRAPER_IMPORT_ENDPOINT unset — skipped upload");
  }
}

run().catch((err) => {
  console.error("[doctoralia-scraper] fatal:", err);
  process.exit(1);
});
