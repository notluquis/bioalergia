import type { Context } from "hono";

// Client IP extraction safe behind Cloudflare → Railway.
//
// Cloudflare sets `cf-connecting-ip` to the real originating client IP.
// This header is added inside Cloudflare's network and cannot be spoofed
// by upstream callers (Cloudflare overwrites any client-supplied value).
// When the request reaches us NOT via Cloudflare, fall back to the
// rightmost `x-forwarded-for` entry, which is the closest hop we can
// trust — leftmost is attacker-controlled.
//
// Refs:
//   - https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip
//   - OWASP Cheat Sheet: do not trust leftmost X-Forwarded-For value.
export function clientIp(c: Context): string | null {
  const cf = c.req.header("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1] ?? null;
  }
  const real = c.req.header("x-real-ip")?.trim();
  return real || null;
}
