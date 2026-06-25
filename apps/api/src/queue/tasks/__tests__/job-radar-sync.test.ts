import { beforeEach, describe, expect, it, vi } from "vitest";

const { markFailedMock, syncJobRadarMock, logErrorMock, logEventMock } = vi.hoisted(() => ({
  markFailedMock: vi.fn(),
  syncJobRadarMock: vi.fn(),
  logErrorMock: vi.fn(),
  logEventMock: vi.fn(),
}));

vi.mock("../../../services/job-radar.ts", () => ({
  markJobRadarSyncFailed: markFailedMock,
  syncJobRadar: syncJobRadarMock,
}));
vi.mock("../../../lib/logger.ts", () => ({
  logError: logErrorMock,
  logEvent: logEventMock,
}));

const { job_radar_sync } = await import("../job-radar-sync.ts");

function fakeHelpers() {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  syncJobRadarMock.mockResolvedValue({
    closed: 0,
    fetched: 0,
    inserted: 0,
    notified: 0,
    sources: [],
    unchanged: 0,
    updated: 0,
  });
});

describe("job_radar_sync", () => {
  it("passes manual trigger through to the service", async () => {
    await job_radar_sync({ triggerSource: "manual" }, fakeHelpers() as never);

    expect(syncJobRadarMock).toHaveBeenCalledWith({ triggerSource: "manual" });
  });

  it("falls back to cron trigger for untrusted payloads", async () => {
    await job_radar_sync({ triggerSource: "wat" }, fakeHelpers() as never);

    expect(syncJobRadarMock).toHaveBeenCalledWith({ triggerSource: "cron" });
  });

  it("marks progress failed and rethrows on service failure", async () => {
    const error = new Error("boom");
    syncJobRadarMock.mockRejectedValue(error);

    await expect(
      job_radar_sync({ triggerSource: "manual" }, fakeHelpers() as never)
    ).rejects.toThrow("boom");
    expect(markFailedMock).toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      "queue.job_radar_sync.failed",
      error,
      expect.objectContaining({ triggerSource: "manual" })
    );
  });
});
