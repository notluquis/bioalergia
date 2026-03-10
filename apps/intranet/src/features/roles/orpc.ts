import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { Permission, Role } from "@/types/roles";

type RoleMapping = {
  app_role: string;
  employee_role: string;
};

type RoleUser = {
  email: string;
  id: number;
  person: null | {
    fatherName: string;
    names: string;
  };
};

type RolesORPCClient = {
  create: (input: { description: string; name: string }) => Promise<{ status: "ok" }>;
  delete: (input: { id: number }) => Promise<{ status: "ok" }>;
  list: () => Promise<{ roles: Role[] }>;
  listMappings: () => Promise<{ data: RoleMapping[] }>;
  permissions: () => Promise<{ permissions: Permission[] }>;
  reassignUsers: (input: { id: number; targetRoleId: number }) => Promise<{
    reassigned: number;
    status: "ok";
  }>;
  roleUsers: (input: { id: number }) => Promise<{ users: RoleUser[] }>;
  saveMapping: (input: RoleMapping) => Promise<{ status: "ok" }>;
  syncPermissions: () => Promise<{
    created: number;
    details: string[];
    errors?: string[];
    skipped: number;
    status: "ok";
    total: number;
  }>;
  telemetryUnmappedSubjects: (input: {
    subjects?: string[];
    timestamp?: string;
    total?: number;
  }) => Promise<{ skipped?: boolean; status: "ok" }>;
  update: (input: {
    id: number;
    payload: { description: string; name: string };
  }) => Promise<{ status: "ok" }>;
  updatePermissions: (input: { id: number; permissionIds: number[] }) => Promise<{ status: "ok" }>;
};

const rolesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const rolesORPCClient = createORPCClient<RolesORPCClient>(rolesORPCLink, {
  path: ["api", "orpc", "roles", "rpc"],
});

export function toRolesApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}

export type { RoleMapping, RoleUser };
