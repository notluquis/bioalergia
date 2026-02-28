import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { User, UserProfile, UserProfileUpdatePayload } from "./types";

export interface UsersResponse {
  users: User[];
}

const StatusResponseSchema = z.looseObject({ message: z.string().optional(), status: z.string() });
const UsersResponseSchema = z.object({ users: z.array(z.unknown()) });
const UserProfileResponseSchema = z.object({ data: z.unknown() });
const InviteUserResponseSchema = z.object({
  tempPassword: z.string().optional(),
  userId: z.number(),
});
const ResetPasswordResponseSchema = z.object({ tempPassword: z.string() });

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/api/users/${userId}`, { responseSchema: StatusResponseSchema });
}

export async function deleteUserPasskey(userId: number): Promise<void> {
  await apiClient.delete(`/api/users/${userId}/passkey`, { responseSchema: StatusResponseSchema });
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await apiClient.get<{ data: UserProfile }>("/api/users/profile", {
    responseSchema: UserProfileResponseSchema,
  });
  return res.data;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await apiClient.get<UsersResponse>("/api/users", {
    responseSchema: UsersResponseSchema,
  });
  return res.users;
}

export async function inviteUser(
  payload: Record<string, unknown>,
): Promise<{ tempPassword?: string; userId: number }> {
  return apiClient.post("/api/users/invite", payload, { responseSchema: InviteUserResponseSchema });
}

export async function resetUserPassword(userId: number): Promise<string> {
  const res = await apiClient.post<{ tempPassword: string }>(
    `/api/users/${userId}/reset-password`,
    {},
    { responseSchema: ResetPasswordResponseSchema },
  );
  return res.tempPassword;
}

export async function setupUser(payload: Record<string, unknown>): Promise<void> {
  await apiClient.post("/api/users/setup", payload, { responseSchema: StatusResponseSchema });
}

export async function toggleUserMfa(userId: number, enabled: boolean): Promise<void> {
  const res = await apiClient.post<{ message?: string; status: string }>(
    `/api/users/${userId}/mfa/toggle`,
    {
      enabled,
    },
    { responseSchema: StatusResponseSchema },
  );
  if (res.status !== "ok") {
    throw new Error(res.message || "Error al cambiar estado MFA");
  }
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
  await apiClient.put(
    `/api/users/${userId}/role`,
    { role },
    { responseSchema: StatusResponseSchema },
  );
}

export async function updateUserStatus(userId: number, status: string): Promise<void> {
  await apiClient.put(
    `/api/users/${userId}/status`,
    { status },
    { responseSchema: StatusResponseSchema },
  );
}

const UserProfileUpdatePayloadSchema = z.object({
  address: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountType: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  email: z.email(),
  fatherName: z.string().nullable().optional(),
  mfaEnforced: z.boolean().optional(),
  motherName: z.string().nullable().optional(),
  names: z.string().min(1),
  phone: z.string().nullable().optional(),
  position: z.string().min(1),
  rut: z.string().min(1),
});

export async function updateUserProfile(
  userId: number,
  payload: UserProfileUpdatePayload,
): Promise<void> {
  const parsedPayload = UserProfileUpdatePayloadSchema.parse(payload);
  await apiClient.put(`/api/users/${userId}/profile`, parsedPayload, {
    responseSchema: StatusResponseSchema,
  });
}
