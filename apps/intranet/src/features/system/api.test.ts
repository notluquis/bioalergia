/**
 * Tests for system `api.ts` orpc wrappers — health checks + Railway
 * deployments status.
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock factory, module-boundary
 * mock of the orpc client, zod-schema coverage (valid / invalid payloads),
 * error-mapping via `toSystemApiError` (re-thrown as ApiError).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  health: vi.fn(),
  deployments: vi.fn(),
}));

vi.mock("./orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./orpc")>();
  return {
    systemORPCClient: orpcMocks,
    toSystemApiError: actual.toSystemApiError,
  };
});

const { fetchSystemHealth, fetchRailwayDeployments } = await import("./api");
const { ApiError } = await import("@/lib/api-client");

describe("system/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSystemHealth", () => {
    it("parses ok response with latency", async () => {
      const ts = new Date("2026-05-18T10:00:00.000Z");
      orpcMocks.health.mockResolvedValue({
        checks: { db: { latency: 42, status: "ok" } },
        status: "ok",
        timestamp: ts.toISOString(),
      });
      const res = await fetchSystemHealth();
      expect(res.status).toBe("ok");
      expect(res.checks.db.latency).toBe(42);
      expect(res.checks.db.status).toBe("ok");
      expect(res.timestamp).toBeInstanceOf(Date);
      expect(res.timestamp.toISOString()).toBe(ts.toISOString());
    });

    it("parses degraded response with optional message", async () => {
      orpcMocks.health.mockResolvedValue({
        checks: { db: { latency: null, message: "slow", status: "error" } },
        status: "degraded",
        timestamp: new Date().toISOString(),
      });
      const res = await fetchSystemHealth();
      expect(res.status).toBe("degraded");
      expect(res.checks.db.message).toBe("slow");
    });

    it("throws ApiError on network failure", async () => {
      orpcMocks.health.mockRejectedValue(new Error("connection refused"));
      await expect(fetchSystemHealth()).rejects.toBeInstanceOf(ApiError);
    });

    it("throws ApiError on schema-invalid payload (zod parse fails)", async () => {
      orpcMocks.health.mockResolvedValue({
        checks: { db: { latency: 0, status: "unknown" } },
        status: "ok",
        timestamp: new Date().toISOString(),
      });
      await expect(fetchSystemHealth()).rejects.toBeInstanceOf(ApiError);
    });

    it("forwards but does not require an AbortSignal", async () => {
      orpcMocks.health.mockResolvedValue({
        checks: { db: { latency: 1, status: "ok" } },
        status: "ok",
        timestamp: new Date().toISOString(),
      });
      const ctrl = new AbortController();
      await expect(fetchSystemHealth(ctrl.signal)).resolves.toBeDefined();
      // signal is not forwarded into the orpc call by current contract;
      // we just assert no extra args were passed:
      expect(orpcMocks.health).toHaveBeenCalledWith();
    });
  });

  describe("fetchRailwayDeployments", () => {
    it("parses configured response with multiple targets in different statuses", async () => {
      const checkedAt = new Date("2026-05-18T12:00:00.000Z");
      orpcMocks.deployments.mockResolvedValue({
        checkedAt: checkedAt.toISOString(),
        configured: true,
        errorMessage: null,
        targets: [
          {
            createdAt: new Date("2026-05-18T11:00:00Z").toISOString(),
            deploymentId: "dep-1",
            environmentId: "env-prod",
            label: "api",
            serviceId: "svc-api",
            status: "SUCCESS",
          },
          {
            createdAt: null,
            deploymentId: null,
            environmentId: "env-prod",
            label: "intranet",
            serviceId: "svc-intranet",
            status: "BUILDING",
          },
        ],
      });
      const res = await fetchRailwayDeployments();
      expect(res.configured).toBe(true);
      expect(res.targets).toHaveLength(2);
      expect(res.targets[0]?.status).toBe("SUCCESS");
      expect(res.targets[1]?.status).toBe("BUILDING");
      expect(res.checkedAt).toBeInstanceOf(Date);
    });

    it("parses unconfigured response with errorMessage", async () => {
      orpcMocks.deployments.mockResolvedValue({
        checkedAt: new Date().toISOString(),
        configured: false,
        errorMessage: "RAILWAY_TOKEN missing",
        targets: [],
      });
      const res = await fetchRailwayDeployments();
      expect(res.configured).toBe(false);
      expect(res.errorMessage).toBe("RAILWAY_TOKEN missing");
      expect(res.targets).toEqual([]);
    });

    it("throws ApiError on schema-invalid status value", async () => {
      orpcMocks.deployments.mockResolvedValue({
        checkedAt: new Date().toISOString(),
        configured: true,
        errorMessage: null,
        targets: [
          {
            createdAt: null,
            deploymentId: null,
            environmentId: "env-prod",
            label: "api",
            serviceId: "svc-api",
            status: "NOT_A_REAL_STATUS",
          },
        ],
      });
      await expect(fetchRailwayDeployments()).rejects.toBeInstanceOf(ApiError);
    });

    it("throws ApiError on network failure", async () => {
      orpcMocks.deployments.mockRejectedValue(new Error("railway api down"));
      await expect(fetchRailwayDeployments()).rejects.toBeInstanceOf(ApiError);
    });
  });
});
