import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { User, UserProfile, UserProfileUpdatePayload } from "./types";

type UsersORPCClient = {
  delete: (input: { id: number }) => Promise<{ status: "ok" }>;
  deletePasskey: (input: { id: number }) => Promise<{ status: "ok" }>;
  invite: (input: Record<string, unknown>) => Promise<{
    status: "ok";
    tempPassword?: string;
    userId: number;
  }>;
  list: (input?: { includeTest?: boolean }) => Promise<{ status: "ok"; users: User[] }>;
  profile: () => Promise<{ data: UserProfile; status: "ok" }>;
  resetPassword: (input: { id: number }) => Promise<{ status: "ok"; tempPassword: string }>;
  setup: (input: Record<string, unknown>) => Promise<{ message?: string; status: "ok" }>;
  toggleMfa: (input: { enabled: boolean; id: number }) => Promise<{
    mfaEnabled: boolean;
    status: "ok";
  }>;
  updateProfile: (input: {
    id: number;
    payload: UserProfileUpdatePayload;
  }) => Promise<{ status: "ok" }>;
  updateRole: (input: { id: number; role: string }) => Promise<{ status: "ok" }>;
  updateStatus: (input: {
    id: number;
    status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  }) => Promise<{ status: "ok" }>;
};

const usersORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const usersORPCClient = createORPCClient<UsersORPCClient>(usersORPCLink, {
  path: ["api", "orpc", "users", "rpc"],
});

export function toUsersApiError(error: unknown): ApiError {
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
