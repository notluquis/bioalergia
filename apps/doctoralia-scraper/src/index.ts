import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Impit, type HttpMethod } from "impit";
import { loadConfig, type ScraperConfig } from "./config.js";
import { CookieJar } from "./cookies.js";
import { type CapturedEntry, postToImportEndpoint, saveCaptureToDisk } from "./submit.js";

const discoverMode = process.argv.includes("--discover");

function log(...args: unknown[]): void {
  console.log("[doctoralia-scraper]", ...args);
}

function monthRange(today = new Date()): { from: string; to: string } {
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

class ImpitSession {
  readonly impit: Impit;
  constructor(readonly jar: CookieJar) {
    this.impit = new Impit({ browser: "chrome", ignoreTlsErrors: false });
  }

  async request(
    url: string,
    init: { method?: HttpMethod; headers?: Record<string, string>; body?: string; redirect?: "follow" | "manual" } = {},
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

async function ensureLoggedIn(session: ImpitSession, config: ScraperConfig): Promise<void> {
  log("GET", config.baseUrl);
  const initial = await session.request(config.baseUrl);
  log(`  → ${initial.status} ${initial.url}`);

  const landedOnLogin = /l\.doctoralia\.cl/i.test(initial.url) || /login/i.test(initial.url);
  if (!landedOnLogin) {
    log("session reused — already inside panel");
    return;
  }

  log("not logged in — starting login flow at", initial.url);

  if (discoverMode) {
    const snapshot = path.join(config.capturesDir, "login-page.html");
    fs.mkdirSync(config.capturesDir, { recursive: true });
    fs.writeFileSync(snapshot, initial.text, "utf8");
    log(`--discover: wrote raw login HTML to ${snapshot}`);
    log("inspect it to find the form action, hidden inputs (CSRF), and field names, then wire them here.");
    process.exit(0);
  }

  // Best-effort extraction of the form action + hidden fields from the HTML
  const form = extractLoginForm(initial.text, initial.url);
  log("detected form:", { action: form.action, hiddenKeys: Object.keys(form.hidden) });

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
      Referer: initial.url,
      Origin: new URL(initial.url).origin,
    },
    body: body.toString(),
  });
  log(`  → ${loginRes.status} ${loginRes.url}`);

  if (/otp|código|verification|verificación/i.test(loginRes.text) && /input/i.test(loginRes.text)) {
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

function extractLoginForm(html: string, pageUrl: string): {
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

  const emailField = /<input[^>]*\bname=["']([^"']+)["'][^>]*\btype=["']email["']/i.exec(formHtml)?.[1]
    ?? /<input[^>]*\btype=["']email["'][^>]*\bname=["']([^"']+)["']/i.exec(formHtml)?.[1]
    ?? "email";
  const passwordField = /<input[^>]*\bname=["']([^"']+)["'][^>]*\btype=["']password["']/i.exec(formHtml)?.[1]
    ?? /<input[^>]*\btype=["']password["'][^>]*\bname=["']([^"']+)["']/i.exec(formHtml)?.[1]
    ?? "password";

  return { action, hidden, emailField, passwordField };
}

async function fetchCalendarEvents(session: ImpitSession, config: ScraperConfig): Promise<CapturedEntry[]> {
  const { from, to } = monthRange();
  const candidates = [
    `${config.baseUrl}/api/calendarevents?from=${from}&to=${to}`,
    `${config.baseUrl}/calendarevents?from=${from}&to=${to}`,
    `${config.baseUrl}/calendar/events?from=${from}&to=${to}`,
  ];

  const results: CapturedEntry[] = [];
  for (const url of candidates) {
    log("GET", url);
    const res = await session.request(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    log(`  → ${res.status}`);
    if (res.status !== 200) continue;
    try {
      const json = JSON.parse(res.text);
      results.push({ ts: new Date().toISOString(), src: url, data: json });
      log(`  captured JSON, keys=${Object.keys(json).slice(0, 6).join(",")}`);
      break;
    } catch {
      log("  response not JSON, skipping");
    }
  }
  return results;
}

async function run(): Promise<void> {
  const config = loadConfig();
  const jar = new CookieJar(config.cookieJarPath);
  jar.load();
  log(`loaded ${jar.size()} cookies from ${config.cookieJarPath}`);

  const session = new ImpitSession(jar);

  await ensureLoggedIn(session, config);
  jar.save();

  const captured = await fetchCalendarEvents(session, config);
  jar.save();

  if (captured.length === 0) {
    log("no calendarevents captured. Try `pnpm --filter @finanzas/doctoralia-scraper discover` first to inspect the login page and find the real endpoint.");
    return;
  }

  const file = saveCaptureToDisk(config.capturesDir, captured);
  log(`saved ${captured.length} entries to ${file}`);

  if (config.importEndpoint) {
    log(`POST ${config.importEndpoint}`);
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
