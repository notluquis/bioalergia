/**
 * Tests for backup `api.ts` orpc wrappers.
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock factory, module-boundary
 * mocking only (the orpc client), success + error path coverage for every
 * exported async function, ApiError mapping via `toBackupsApiError`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  list: vi.fn(),
  tables: vi.fn(),
  trigger: vi.fn(),
  restore: vi.fn(),
  history: vi.fn(),
  logs: vi.fn(),
}));

vi.mock("./orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./orpc")>();
  return {
    backupsORPCClient: orpcMocks,
    toBackupsApiError: actual.toBackupsApiError,
  };
});

const { fetchBackups, fetchTables, triggerBackup, triggerRestore } = await import("./api");
const { ApiError } = await import("@/lib/api-client");

const baseJob = {
  currentStep: "init",
  id: "job-1",
  progress: 0,
  startedAt: new Date("2026-05-01T12:00:00Z"),
  status: "pending" as const,
  type: "full" as const,
};

describe("backup/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchBackups", () => {
    it("returns parsed list of backup files (Google Drive)", async () => {
      orpcMocks.list.mockResolvedValue({
        backups: [
          {
            createdTime: "2026-05-01T10:00:00Z",
            id: "drive-file-1",
            name: "backup-2026-05-01.sql.gz",
            size: "1048576",
            webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
          },
        ],
      });

      const result = await fetchBackups();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("drive-file-1");
      expect(result[0]?.createdTime).toBeInstanceOf(Date);
      expect(orpcMocks.list).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when Drive has no backups", async () => {
      orpcMocks.list.mockResolvedValue({ backups: [] });
      await expect(fetchBackups()).resolves.toEqual([]);
    });

    it("wraps network errors as ApiError (Drive disconnected)", async () => {
      orpcMocks.list.mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(fetchBackups()).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps malformed response (Zod parse failure) as ApiError", async () => {
      orpcMocks.list.mockResolvedValue({ wrong: "shape" });
      await expect(fetchBackups()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("fetchTables", () => {
    it("forwards fileId and returns table list", async () => {
      orpcMocks.tables.mockResolvedValue({
        tables: ["users", "patients", "appointments"],
      });

      const result = await fetchTables("drive-file-1");

      expect(orpcMocks.tables).toHaveBeenCalledWith({ fileId: "drive-file-1" });
      expect(result).toEqual(["users", "patients", "appointments"]);
    });

    it("wraps not-found errors as ApiError", async () => {
      orpcMocks.tables.mockRejectedValue(new Error("Backup file not found"));
      await expect(fetchTables("missing")).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("triggerBackup", () => {
    it("kicks off a backup job and returns initial state", async () => {
      orpcMocks.trigger.mockResolvedValue({
        status: "ok",
        message: "Backup started",
        job: baseJob,
      });

      const job = await triggerBackup();

      expect(job.id).toBe("job-1");
      expect(job.status).toBe("pending");
      expect(job.startedAt).toBeInstanceOf(Date);
      expect(orpcMocks.trigger).toHaveBeenCalledTimes(1);
    });

    it("rejects malformed trigger response (no status:'ok')", async () => {
      orpcMocks.trigger.mockResolvedValue({ status: "error", job: baseJob });
      await expect(triggerBackup()).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps server errors (Drive quota exceeded) as ApiError", async () => {
      orpcMocks.trigger.mockRejectedValue(new Error("Drive quota exceeded"));
      await expect(triggerBackup()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("triggerRestore", () => {
    it("forwards fileId and optional tables filter", async () => {
      orpcMocks.restore.mockResolvedValue({
        status: "ok",
        job: {
          backupFileId: "drive-file-1",
          currentStep: "init",
          id: "restore-1",
          progress: 0,
          startedAt: new Date("2026-05-01T12:00:00Z"),
          status: "pending" as const,
          tables: ["users"],
        },
      });

      const job = await triggerRestore("drive-file-1", ["users"]);

      expect(orpcMocks.restore).toHaveBeenCalledWith({
        fileId: "drive-file-1",
        tables: ["users"],
      });
      expect(job.id).toBe("restore-1");
      expect(job.tables).toEqual(["users"]);
    });

    it("allows undefined tables (full restore)", async () => {
      orpcMocks.restore.mockResolvedValue({
        status: "ok",
        job: {
          backupFileId: "drive-file-1",
          currentStep: "init",
          id: "restore-2",
          progress: 0,
          startedAt: new Date("2026-05-01T12:00:00Z"),
          status: "pending" as const,
        },
      });

      await triggerRestore("drive-file-1");

      expect(orpcMocks.restore).toHaveBeenCalledWith({
        fileId: "drive-file-1",
        tables: undefined,
      });
    });

    it("wraps errors as ApiError (restore cancelled / file gone)", async () => {
      orpcMocks.restore.mockRejectedValue(new Error("Restore failed"));
      await expect(triggerRestore("drive-file-1")).rejects.toBeInstanceOf(ApiError);
    });
  });
});
