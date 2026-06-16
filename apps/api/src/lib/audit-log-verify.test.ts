import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { type AuditRow, devFallbackKey, verifyRows } from "./audit-log-verify.ts";

// Mirror of rowDigest() in audit-log-verify.ts (and the SQL trigger). These
// tests target the latch / link / tamper logic of verifyRows, given a correct
// digest — so replicating the digest construction here is intentional.
const ZERO = Buffer.alloc(32);

function digest(prev: Buffer, row: Omit<AuditRow, "prevHash" | "entryHash">, key: Buffer): Buffer {
  const concat = Buffer.concat([
    prev,
    Buffer.from(row.occurredAt.toISOString().replace("T", " ").replace("Z", ""), "utf8"),
    Buffer.from(row.kind ?? "", "utf8"),
    Buffer.from(row.userId == null ? "" : String(row.userId), "utf8"),
    Buffer.from(row.actorLabel ?? "", "utf8"),
    Buffer.from(row.ip ?? "", "utf8"),
    Buffer.from(row.userAgent ?? "", "utf8"),
    Buffer.from(row.resource ?? "", "utf8"),
    Buffer.from(row.resourceId ?? "", "utf8"),
    Buffer.from(row.outcome ?? "", "utf8"),
    Buffer.from(row.message ?? "", "utf8"),
    Buffer.from(row.metadata == null ? "" : JSON.stringify(row.metadata), "utf8"),
  ]);
  return createHmac("sha256", key).update(concat).digest();
}

const REAL_KEY = Buffer.from("a".repeat(64), "hex");
const DEV_KEY = devFallbackKey("bioalergia");

function row(id: number, prev: Buffer, key: Buffer): AuditRow {
  const fields: Omit<AuditRow, "prevHash" | "entryHash"> = {
    id: String(id),
    occurredAt: new Date(Date.UTC(2026, 0, id, 0, 0, 0)),
    kind: "ficha.read",
    userId: id,
    actorLabel: `user-${id}`,
    ip: "127.0.0.1",
    userAgent: "test",
    resource: "patient",
    resourceId: String(id),
    outcome: "ok",
    message: null,
    metadata: { i: id },
  };
  return { ...fields, prevHash: prev, entryHash: digest(prev, fields, key) };
}

/** Build an id-ASC chain: first `devCount` rows dev-keyed, rest real-keyed. */
function chain(devCount: number, realCount: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let prev = ZERO;
  for (let i = 1; i <= devCount + realCount; i++) {
    const key = i <= devCount ? DEV_KEY : REAL_KEY;
    const r = row(i, prev, key);
    rows.push(r);
    prev = r.entryHash;
  }
  return rows;
}

describe("verifyRows", () => {
  it("returns null for an intact all-dev chain (pre-cutover)", () => {
    expect(verifyRows(chain(5, 0), REAL_KEY, DEV_KEY)).toBeNull();
  });

  it("returns null for an intact all-real chain (post-cutover)", () => {
    expect(verifyRows(chain(0, 5), REAL_KEY, DEV_KEY)).toBeNull();
  });

  it("returns null across the dev→real cutover transition", () => {
    expect(verifyRows(chain(3, 4), REAL_KEY, DEV_KEY)).toBeNull();
  });

  it("returns null for an empty chain", () => {
    expect(verifyRows([], REAL_KEY, DEV_KEY)).toBeNull();
  });

  it("detects a tampered field (HMAC mismatch)", () => {
    const rows = chain(2, 3);
    rows[3] = { ...rows[3]!, message: "tampered" };
    expect(verifyRows(rows, REAL_KEY, DEV_KEY)).toBe(4n);
  });

  it("detects a broken prev_hash link", () => {
    const rows = chain(0, 4);
    rows[2] = { ...rows[2]!, prevHash: Buffer.alloc(32, 0xff) };
    expect(verifyRows(rows, REAL_KEY, DEV_KEY)).toBe(3n);
  });

  it("rejects a dev-keyed row after the real key has latched (downgrade-forge)", () => {
    // 2 dev rows, 2 real rows (latches), then a 5th row re-chained with the
    // dev key — an attacker who knows the derivable dev key forging a new row.
    const rows = chain(2, 2);
    const forged = row(5, rows[3]!.entryHash, DEV_KEY);
    rows.push(forged);
    expect(verifyRows(rows, REAL_KEY, DEV_KEY)).toBe(5n);
  });

  it("detects tampering of the very first row", () => {
    const rows = chain(0, 3);
    rows[0] = { ...rows[0]!, outcome: "fail" };
    expect(verifyRows(rows, REAL_KEY, DEV_KEY)).toBe(1n);
  });
});
