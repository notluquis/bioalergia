import { describe, expect, it, vi } from "vitest";

// The service module imports `{ kysely } from "@finanzas/db"` at load time. We
// only exercise the pure de-qualification contract here, so a no-op db mock is
// enough to import the module without opening a real connection.
vi.mock("@finanzas/db", () => ({ db: {}, kysely: {} }));

const { isTerminalSkinTestImportStatus, isOneDriveItemUnchanged } = await import(
  "../clinical-skin-test-imports.ts"
);

// Regression guard for the OneDrive de-qualification reconcile (file renamed so
// it stops matching isImportableSkinTestFilename — e.g. patient name ->
// "_PRICK TEST ALIMENTARIO I (2).xlsx"). The reconcile refreshes metadata for
// every tracked row but must ONLY auto-demote NON-terminal rows to SKIPPED.
// Terminal rows (a materialized exam, an operator rejection, or a row already
// moved to a clinical record) must keep their status untouched — demoting an
// IMPORTED row would silently orphan the materialized skin test.
describe("isTerminalSkinTestImportStatus", () => {
  it.each(["IMPORTED", "REJECTED", "MOVED_TO_RECORD"])(
    "treats %s as terminal (status preserved on de-qualification)",
    (status) => {
      expect(isTerminalSkinTestImportStatus(status)).toBe(true);
    }
  );

  it.each(["DISCOVERED", "PENDING_REVIEW", "ERROR", "SKIPPED", "TEMPLATE"])(
    "treats %s as non-terminal (demoted to SKIPPED on de-qualification)",
    (status) => {
      expect(isTerminalSkinTestImportStatus(status)).toBe(false);
    }
  );

  it("does not treat an unknown status as terminal", () => {
    expect(isTerminalSkinTestImportStatus("WHATEVER")).toBe(false);
  });
});

// OneDrive change detection (#3). eTag changes on ANY change; cTag is content-only
// and OneDrive for Business OMITS it on Create/Modify (Graph docs) — a missing
// cTag must NOT read as "changed" or every sync re-downloads needlessly.
describe("isOneDriveItemUnchanged", () => {
  it("is unchanged when eTag + cTag both match", () => {
    expect(isOneDriveItemUnchanged("etag-1", "ctag-1", "etag-1", "ctag-1")).toBe(true);
  });

  it("is changed when eTag differs (rename/move/content)", () => {
    expect(isOneDriveItemUnchanged("etag-1", "ctag-1", "etag-2", "ctag-1")).toBe(false);
  });

  it("is changed when cTag differs (content edit, same eTag is impossible but be safe)", () => {
    expect(isOneDriveItemUnchanged("etag-1", "ctag-1", "etag-1", "ctag-2")).toBe(false);
  });

  it("trusts eTag alone when the incoming cTag is absent (OneDrive Business)", () => {
    expect(isOneDriveItemUnchanged("etag-1", "ctag-1", "etag-1", undefined)).toBe(true);
    expect(isOneDriveItemUnchanged("etag-1", "ctag-1", "etag-1", null)).toBe(true);
    expect(isOneDriveItemUnchanged("etag-1", "ctag-1", "etag-1", "")).toBe(true);
  });

  it("never matches when the stored eTag is missing", () => {
    expect(isOneDriveItemUnchanged(null, null, null, null)).toBe(false);
    expect(isOneDriveItemUnchanged(undefined, undefined, undefined, undefined)).toBe(false);
  });

  it("does not falsely flag stored-null vs incoming-undefined cTag as changed", () => {
    // The original bug: `null === undefined` -> false -> needless re-download.
    expect(isOneDriveItemUnchanged("etag-1", null, "etag-1", undefined)).toBe(true);
  });
});
