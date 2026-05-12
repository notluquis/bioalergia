// Per-email login throttle. Complements per-user lockout
// (lib/account-lockout.ts) by also throttling attempts against
// nonexistent emails — otherwise an attacker could enumerate valid
// emails by observing which ones eventually return "locked" vs
// "wrong password".
//
// In-memory sliding window. Single-instance Railway by design (see
// CLAUDE.local.md); a multi-replica deployment would need to back
// this with Redis.
//
// Refs:
//   - OWASP Authentication Cheat Sheet § Account Enumeration
//   - OWASP Credential Stuffing Prevention Cheat Sheet
//   - NIST SP 800-63-4 § 5.2.2 (rate limiting on auth endpoints)

const WINDOW_MS = 15 * 60 * 1000;
const SHORT_THRESHOLD = 5; // → 15 min cooldown
const LONG_THRESHOLD = 10; // → 1 h cooldown
const SHORT_BLOCK_MS = 15 * 60 * 1000;
const LONG_BLOCK_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 10_000; // hard cap to bound memory under attack

type Entry = {
  attempts: number;
  windowStart: number;
  blockedUntil: number | null;
};

const store = new Map<string, Entry>();

function normalizeKey(email: string): string {
  return email.trim().toLowerCase();
}

function evictIfFull(): void {
  if (store.size < MAX_ENTRIES) return;
  // Drop oldest unblocked entry.
  const now = Date.now();
  for (const [k, v] of store) {
    if (!v.blockedUntil || v.blockedUntil < now) {
      store.delete(k);
      if (store.size < MAX_ENTRIES) return;
    }
  }
}

export function isEmailThrottled(email: string): { blocked: boolean; retryAfterMs: number } {
  const key = normalizeKey(email);
  const entry = store.get(key);
  if (!entry?.blockedUntil) return { blocked: false, retryAfterMs: 0 };
  const remaining = entry.blockedUntil - Date.now();
  if (remaining <= 0) {
    entry.blockedUntil = null;
    return { blocked: false, retryAfterMs: 0 };
  }
  return { blocked: true, retryAfterMs: remaining };
}

export function recordEmailLoginFailure(email: string): {
  attempts: number;
  blockedUntil: number | null;
} {
  const key = normalizeKey(email);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { attempts: 0, windowStart: now, blockedUntil: null };
    evictIfFull();
    store.set(key, entry);
  }
  entry.attempts += 1;
  if (entry.attempts >= LONG_THRESHOLD) {
    entry.blockedUntil = now + LONG_BLOCK_MS;
  } else if (entry.attempts >= SHORT_THRESHOLD) {
    entry.blockedUntil = now + SHORT_BLOCK_MS;
  }
  return { attempts: entry.attempts, blockedUntil: entry.blockedUntil };
}

export function clearEmailLoginFailure(email: string): void {
  store.delete(normalizeKey(email));
}
