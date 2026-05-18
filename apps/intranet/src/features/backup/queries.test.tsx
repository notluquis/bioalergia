/**
 * Tests for backup `queries.ts` — TanStack Query keys + queryFn wiring +
 * retry policy.
 *
 * Golden 2026 patterns: mock the api layer (module boundary), assert
 * queryKey shapes are stable (cache invariant), exercise the
 * `shouldRetryBackupTables` policy via the retry callback.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  fetchBackups: vi.fn(),
  fetchTables: vi.fn(),
}));

vi.mock("./api", () => apiMocks);

const { backupKeys } = await import("./queries");
const { ApiError } = await import("@/lib/api-client");

describe("backup/queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("all key is stable", () => {
    expect(backupKeys.all).toEqual(["backups"]);
  });

  describe("lists()", () => {
    it("builds the canonical list query key", () => {
      expect(backupKeys.lists().queryKey).toEqual(["backups"]);
    });

    it("queryFn calls fetchBackups", async () => {
      apiMocks.fetchBackups.mockResolvedValue([]);
      await backupKeys.lists().queryFn!({} as never);
      expect(apiMocks.fetchBackups).toHaveBeenCalledTimes(1);
    });
  });

  describe("tables(fileId)", () => {
    it("scopes the query key by fileId", () => {
      const opts = backupKeys.tables("drive-file-7");
      expect(opts.queryKey).toEqual(["backup-tables", "drive-file-7"]);
    });

    it("queryFn forwards fileId to fetchTables", async () => {
      apiMocks.fetchTables.mockResolvedValue(["users"]);
      await backupKeys.tables("drive-file-7").queryFn!({} as never);
      expect(apiMocks.fetchTables).toHaveBeenCalledWith("drive-file-7");
    });

    it("uses a 60s staleTime to avoid hammering Drive", () => {
      expect(backupKeys.tables("x").staleTime).toBe(60_000);
    });

    describe("retry policy (shouldRetryBackupTables)", () => {
      const retry = backupKeys.tables("x").retry as (failureCount: number, error: Error) => boolean;

      it("stops retrying after 1 failure", () => {
        expect(retry(1, new Error("x"))).toBe(false);
        expect(retry(2, new Error("x"))).toBe(false);
      });

      it("retries unknown Errors on first failure", () => {
        expect(retry(0, new Error("network blip"))).toBe(true);
      });

      it("retries 5xx ApiError on first failure", () => {
        expect(retry(0, new ApiError("server boom", 503))).toBe(true);
      });

      it("retries 429 ApiError (rate limit) on first failure", () => {
        expect(retry(0, new ApiError("rate limited", 429))).toBe(true);
      });

      it("does NOT retry 4xx ApiError (client error)", () => {
        expect(retry(0, new ApiError("forbidden", 403))).toBe(false);
        expect(retry(0, new ApiError("not found", 404))).toBe(false);
      });
    });
  });
});
