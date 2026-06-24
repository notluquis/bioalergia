// Cross-tab idempotency lock for share-target → conversation sends.
//
// Race scenario: operator shares 3 images from Photos. The SW
// 303-redirects every open intranet tab to /wa-cloud?shared=1.
// Without coordination, two tabs may both hit "Enviar" simultaneously
// and the contact receives the same images twice.
//
// Mechanism: localStorage write of a per-payload key with a short
// TTL. First writer wins. Other tabs read it back and disable the
// send button + show "Otra pestaña está enviando…". Key auto-expires
// so a crashed/closed sender doesn't permanently block the payload.

const KEY_PREFIX = "wa-share-send-lock-";
const TTL_MS = 30_000;

type LockRecord = {
  ts: number;
  // Random per-tab ID so each browser tab can identify ITS own lock
  // (read-after-write checks need to distinguish "I have the lock"
  // from "someone else has it").
  holder: string;
};

const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function key(payloadTs: number): string {
  return `${KEY_PREFIX}${payloadTs}`;
}

export function tryAcquireSendLock(payloadTs: number): boolean {
  if (typeof localStorage === "undefined") return true;
  const k = key(payloadTs);
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const rec = JSON.parse(raw) as LockRecord;
      if (rec.ts + TTL_MS > Date.now() && rec.holder !== TAB_ID) {
        return false;
      }
    }
    const rec: LockRecord = { ts: Date.now(), holder: TAB_ID };
    localStorage.setItem(k, JSON.stringify(rec));
    // Read back to detect concurrent write (last writer in the same
    // ms wins). Browsers serialize storage writes within an origin,
    // so the second writer sees its own value and the first writer's
    // read finds a foreign holder.
    const verify = JSON.parse(localStorage.getItem(k) ?? "{}") as LockRecord;
    return verify.holder === TAB_ID;
  } catch {
    return true;
  }
}

export function releaseSendLock(payloadTs: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(key(payloadTs));
    if (!raw) return;
    const rec = JSON.parse(raw) as LockRecord;
    if (rec.holder === TAB_ID) {
      localStorage.removeItem(key(payloadTs));
    }
  } catch {
    // ignore
  }
}

export function isLockHeldByAnotherTab(payloadTs: number): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(key(payloadTs));
    if (!raw) return false;
    const rec = JSON.parse(raw) as LockRecord;
    return rec.ts + TTL_MS > Date.now() && rec.holder !== TAB_ID;
  } catch {
    return false;
  }
}
