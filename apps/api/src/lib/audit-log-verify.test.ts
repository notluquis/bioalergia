import { describe, expect, it } from "vitest";
import { type RowCheck, verifyRows } from "./audit-log-verify.ts";

// verifyRows is the pure link-membership + key-latch state machine over the
// per-row data the database returns. The HMAC recompute itself lives in SQL
// (see verifyAuditChain) to avoid JS/Postgres serialization drift, so these
// tests target only the link/latch logic.

const ZERO = "00".repeat(32);
// Deterministic fake hashes — content is opaque to verifyRows, only identity
// (which prev_hash points at which entry_hash) matters.
const h = (n: number) => `${n.toString(16).padStart(2, "0")}`.repeat(32);

/** A row whose prev_hash points at `prevN`'s entry_hash and whose own entry is `entryN`. */
function row(id: number, prevN: number | "zero", key: "dev" | "real" | "none"): RowCheck {
  return {
    id: String(id),
    prevHashHex: prevN === "zero" ? ZERO : h(prevN),
    entryHashHex: h(id),
    matchesReal: key === "real",
    matchesDev: key === "dev",
  };
}

describe("verifyRows", () => {
  it("returns null for an intact all-dev linear chain (pre-cutover)", () => {
    expect(verifyRows([row(1, "zero", "dev"), row(2, 1, "dev"), row(3, 2, "dev")])).toBeNull();
  });

  it("returns null for an intact all-real chain (post-cutover)", () => {
    expect(verifyRows([row(1, "zero", "real"), row(2, 1, "real"), row(3, 2, "real")])).toBeNull();
  });

  it("returns null across the dev→real cutover transition", () => {
    expect(
      verifyRows([row(1, "zero", "dev"), row(2, 1, "dev"), row(3, 2, "real"), row(4, 3, "real")])
    ).toBeNull();
  });

  it("tolerates a concurrent fork (two rows share a predecessor)", () => {
    // Rows 3 and 4 both point at row 2's entry_hash — the trigger's
    // non-serialized prev_hash pick under concurrent inserts.
    expect(
      verifyRows([
        row(1, "zero", "dev"),
        row(2, 1, "dev"),
        row(3, 2, "dev"),
        row(4, 2, "dev"),
        row(5, 4, "dev"),
      ])
    ).toBeNull();
  });

  it("returns null for an empty chain", () => {
    expect(verifyRows([])).toBeNull();
  });

  it("detects a row matching neither key (HMAC mismatch / tamper)", () => {
    expect(verifyRows([row(1, "zero", "dev"), row(2, 1, "dev"), row(3, 2, "none")])).toBe(3n);
  });

  it("detects an orphan link — prev_hash matches no earlier row (deletion)", () => {
    // Row 3 points at entry 9, which never appears → row 2 was deleted/altered.
    expect(verifyRows([row(1, "zero", "dev"), row(2, 1, "dev"), row(3, 9, "dev")])).toBe(3n);
  });

  it("rejects a forward link — prev_hash points at a later row", () => {
    // Row 2 points at entry 5, not yet seen → not in `seen`.
    expect(verifyRows([row(1, "zero", "dev"), row(2, 5, "dev")])).toBe(2n);
  });

  it("rejects a dev-keyed row after the real key has latched (downgrade-forge)", () => {
    expect(
      verifyRows([
        row(1, "zero", "dev"),
        row(2, 1, "dev"),
        row(3, 2, "real"),
        row(4, 3, "real"),
        row(5, 4, "dev"),
      ])
    ).toBe(5n);
  });

  it("detects tampering of the very first row", () => {
    expect(verifyRows([row(1, "zero", "none"), row(2, 1, "real")])).toBe(1n);
  });

  it("rejects a first row whose prev_hash is not the genesis zero hash", () => {
    expect(verifyRows([row(1, 9, "dev")])).toBe(1n);
  });
});
