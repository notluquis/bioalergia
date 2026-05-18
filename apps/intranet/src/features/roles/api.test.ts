/**
 * Tests for `apps/intranet/src/features/roles/api.ts`.
 *
 * Golden 2026 patterns:
 * - `vi.hoisted` for the mocked oRPC client (factory hoisting safe).
 * - Mock the module boundary (`./orpc`) — never reach into ApiError /
 *   ORPCError internals.
 * - Cover success + error path for every exported function.
 * - Schema-validation failures bubble out as ApiError (via the catch
 *   block that routes Zod's ZodError through `toRolesApiError`).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api-client";

const orpcMock = vi.hoisted(() => ({
  rolesORPCClient: {
    create: vi.fn(),
    delete: vi.fn(),
    permissions: vi.fn(),
    list: vi.fn(),
    roleUsers: vi.fn(),
    listMappings: vi.fn(),
    reassignUsers: vi.fn(),
    saveMapping: vi.fn(),
    syncPermissions: vi.fn(),
    update: vi.fn(),
    updatePermissions: vi.fn(),
    telemetryUnmappedSubjects: vi.fn(),
  },
}));

vi.mock("./orpc", async () => {
  const actual = await vi.importActual<typeof import("./orpc")>("./orpc");
  return {
    ...actual,
    rolesORPCClient: orpcMock.rolesORPCClient,
  };
});

vi.mock("@/features/hr/employees/api", () => ({
  fetchEmployees: vi.fn().mockResolvedValue([{ id: 1, names: "Ana" }]),
}));

const api = await import("./api");

beforeEach(() => {
  for (const fn of Object.values(orpcMock.rolesORPCClient)) {
    fn.mockReset();
  }
});

describe("createRole", () => {
  it("returns parsed status on success", async () => {
    orpcMock.rolesORPCClient.create.mockResolvedValueOnce({ status: "ok" });
    await expect(api.createRole({ name: "Admin", description: "" })).resolves.toEqual({
      status: "ok",
    });
    expect(orpcMock.rolesORPCClient.create).toHaveBeenCalledWith({
      name: "Admin",
      description: "",
    });
  });

  it("wraps oRPC errors as ApiError", async () => {
    orpcMock.rolesORPCClient.create.mockRejectedValueOnce(new Error("network"));
    await expect(api.createRole({ name: "X", description: "" })).rejects.toBeInstanceOf(ApiError);
  });

  it("wraps schema-validation failures as ApiError", async () => {
    orpcMock.rolesORPCClient.create.mockResolvedValueOnce({ status: "not-ok" });
    await expect(api.createRole({ name: "X", description: "" })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("deleteRole", () => {
  it("posts the id and parses ok status", async () => {
    orpcMock.rolesORPCClient.delete.mockResolvedValueOnce({ status: "ok" });
    await api.deleteRole(42);
    expect(orpcMock.rolesORPCClient.delete).toHaveBeenCalledWith({ id: 42 });
  });

  it("wraps errors", async () => {
    orpcMock.rolesORPCClient.delete.mockRejectedValueOnce(new Error("boom"));
    await expect(api.deleteRole(1)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchPermissions", () => {
  it("returns the permissions array", async () => {
    const permissions = [{ id: 1, action: "read", subject: "Patient" }];
    orpcMock.rolesORPCClient.permissions.mockResolvedValueOnce({ permissions });
    await expect(api.fetchPermissions()).resolves.toEqual(permissions);
  });

  it("wraps schema failures", async () => {
    orpcMock.rolesORPCClient.permissions.mockResolvedValueOnce({ wrong: "shape" });
    await expect(api.fetchPermissions()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchRoles", () => {
  it("returns the roles array", async () => {
    orpcMock.rolesORPCClient.list.mockResolvedValueOnce({ roles: [{ id: 1, name: "Admin" }] });
    await expect(api.fetchRoles()).resolves.toEqual([{ id: 1, name: "Admin" }]);
  });
});

describe("fetchRoleUsers", () => {
  it("forwards the role id and returns users", async () => {
    orpcMock.rolesORPCClient.roleUsers.mockResolvedValueOnce({
      users: [{ id: 1, email: "a@b.cl" }],
    });
    await expect(api.fetchRoleUsers(7)).resolves.toEqual([{ id: 1, email: "a@b.cl" }]);
    expect(orpcMock.rolesORPCClient.roleUsers).toHaveBeenCalledWith({ id: 7 });
  });
});

describe("getRoleMappings", () => {
  it("returns the mappings array (unwrapped from data envelope)", async () => {
    orpcMock.rolesORPCClient.listMappings.mockResolvedValueOnce({
      data: [{ subject: "Patient", roleId: 1 }],
    });
    await expect(api.getRoleMappings()).resolves.toEqual([{ subject: "Patient", roleId: 1 }]);
  });
});

describe("reassignRoleUsers", () => {
  it("calls reassignUsers with the right shape", async () => {
    orpcMock.rolesORPCClient.reassignUsers.mockResolvedValueOnce({ status: "ok" });
    await api.reassignRoleUsers({ roleId: 1, targetRoleId: 2 });
    expect(orpcMock.rolesORPCClient.reassignUsers).toHaveBeenCalledWith({
      id: 1,
      targetRoleId: 2,
    });
  });

  it("wraps errors", async () => {
    orpcMock.rolesORPCClient.reassignUsers.mockRejectedValueOnce(new Error("x"));
    await expect(api.reassignRoleUsers({ roleId: 1, targetRoleId: 2 })).rejects.toBeInstanceOf(
      ApiError
    );
  });
});

describe("saveRoleMapping", () => {
  it("delegates to saveMapping", async () => {
    const mapping = {
      subject: "Patient",
      roleId: 1,
    } as unknown as Parameters<typeof api.saveRoleMapping>[0];
    orpcMock.rolesORPCClient.saveMapping.mockResolvedValueOnce(undefined);
    await api.saveRoleMapping(mapping);
    expect(orpcMock.rolesORPCClient.saveMapping).toHaveBeenCalledWith(mapping);
  });
});

describe("syncPermissions", () => {
  it("delegates to syncPermissions", async () => {
    orpcMock.rolesORPCClient.syncPermissions.mockResolvedValueOnce({ ok: true });
    await expect(api.syncPermissions()).resolves.toEqual({ ok: true });
  });
});

describe("updateRole", () => {
  it("forwards id + payload", async () => {
    orpcMock.rolesORPCClient.update.mockResolvedValueOnce({ status: "ok" });
    await api.updateRole(3, { name: "New", description: "d" });
    expect(orpcMock.rolesORPCClient.update).toHaveBeenCalledWith({
      id: 3,
      payload: { name: "New", description: "d" },
    });
  });
});

describe("updateRolePermissions", () => {
  it("forwards permissionIds", async () => {
    orpcMock.rolesORPCClient.updatePermissions.mockResolvedValueOnce({ status: "ok" });
    await api.updateRolePermissions({ roleId: 1, permissionIds: [10, 20] });
    expect(orpcMock.rolesORPCClient.updatePermissions).toHaveBeenCalledWith({
      id: 1,
      permissionIds: [10, 20],
    });
  });
});

describe("sendUnmappedSubjectsTelemetry", () => {
  it("returns parsed response", async () => {
    orpcMock.rolesORPCClient.telemetryUnmappedSubjects.mockResolvedValueOnce({
      status: "ok",
      skipped: false,
    });
    await expect(api.sendUnmappedSubjectsTelemetry({ subjects: ["X"], total: 1 })).resolves.toEqual(
      { status: "ok", skipped: false }
    );
  });

  it("wraps schema failures", async () => {
    orpcMock.rolesORPCClient.telemetryUnmappedSubjects.mockResolvedValueOnce({
      status: "ko",
    });
    await expect(api.sendUnmappedSubjectsTelemetry({ subjects: ["X"] })).rejects.toBeInstanceOf(
      ApiError
    );
  });
});

describe("roleQueries.mappings", () => {
  it("builds a query that fetches employees, mappings, and roles in parallel", async () => {
    orpcMock.rolesORPCClient.listMappings.mockResolvedValueOnce({ data: [] });
    orpcMock.rolesORPCClient.list.mockResolvedValueOnce({ roles: [{ id: 1, name: "A" }] });
    const options = api.roleQueries.mappings();
    const result = await options.queryFn!({} as never);
    expect(result.dbMappings).toEqual([]);
    expect(result.roles).toEqual([{ id: 1, name: "A" }]);
    expect(result.employees).toEqual([{ id: 1, names: "Ana" }]);
  });
});

describe("roleQueries.users", () => {
  it("scopes the query key by roleId", () => {
    const options = api.roleQueries.users(99);
    expect(options.queryKey).toEqual(["roles", 99, "users"]);
  });
});
