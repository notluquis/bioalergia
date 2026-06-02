import { describe, expect, it, vi } from "vitest";

// onedrive.ts imports the db client at load; a no-op mock lets us import the
// pure delta-resync predicate without opening a connection.
vi.mock("@finanzas/db", () => ({ db: {}, kysely: {} }));

const { isDeltaResyncStatus } = await import("../onedrive.ts");

// 410 resync detection (bug A): the delta token expired and Graph signals
// resyncRequired. Misdetecting this leaves the auto-sync 410ing forever; a false
// positive forces a needless full re-enumeration.
describe("isDeltaResyncStatus", () => {
  it("treats HTTP 410 as resync", () => {
    expect(isDeltaResyncStatus(410)).toBe(true);
    expect(isDeltaResyncStatus(410, "whatever")).toBe(true);
  });

  it("treats a resyncChanges* error code as resync regardless of status", () => {
    expect(isDeltaResyncStatus(400, "resyncChangesApplyDifferences")).toBe(true);
    expect(isDeltaResyncStatus(400, "resyncChangesUploadDifferences")).toBe(true);
    expect(isDeltaResyncStatus(200, "RESYNC_REQUIRED")).toBe(true);
  });

  it("does not treat ordinary errors as resync", () => {
    expect(isDeltaResyncStatus(429)).toBe(false);
    expect(isDeltaResyncStatus(503, "serviceNotAvailable")).toBe(false);
    expect(isDeltaResyncStatus(401, "InvalidAuthenticationToken")).toBe(false);
    expect(isDeltaResyncStatus(404, null)).toBe(false);
    expect(isDeltaResyncStatus(500)).toBe(false);
  });
});
