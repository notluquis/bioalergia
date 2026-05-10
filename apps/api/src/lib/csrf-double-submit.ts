import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";

// Double-submit cookie CSRF protection.
//
// Flow:
//   1. On every authenticated request, ensure a `csrf_token` cookie exists
//      (random 32-byte hex). The cookie is NOT httpOnly so the SPA can read
//      it from `document.cookie`.
//   2. The intranet client mirrors the cookie value into an `X-CSRF-Token`
//      header on every state-changing request (POST/PUT/PATCH/DELETE).
//   3. This middleware compares the header to the cookie via timingSafeEqual.
//      Mismatch / missing → 403.
//
// Why double-submit on top of SameSite=Lax + the hono/csrf Origin check:
// belt-and-suspenders. SameSite gaps (browser bugs, top-level form POSTs,
// older Safari behaviour) cannot bypass the header check because attacker
// pages can read neither the cookie value nor inject custom headers.

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function ensureCsrfCookie(c: Context): string {
  const existing = getCookie(c, CSRF_COOKIE);
  if (existing && existing.length === 64) return existing;
  const token = randomBytes(32).toString("hex");
  setCookie(c, CSRF_COOKIE, token, {
    httpOnly: false, // SPA must read it
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 2, // mirror session TTL
  });
  return token;
}

function timingSafeStringEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function csrfDoubleSubmit(): MiddlewareHandler {
  return async (c, next) => {
    // Always (re-)issue the cookie so the SPA has it after a fresh page load.
    ensureCsrfCookie(c);
    if (SAFE_METHODS.has(c.req.method)) return next();

    const cookie = getCookie(c, CSRF_COOKIE);
    const header = c.req.header(CSRF_HEADER);
    if (!cookie || !header || !timingSafeStringEq(cookie, header)) {
      return c.text("CSRF token missing or invalid", 403);
    }
    return next();
  };
}
