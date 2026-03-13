import { z } from "zod";
import { toUsersApiError, usersORPCClient } from "./orpc";
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
type InviteUserPayload = {
  email: string;
  fatherName?: string;
  mfaEnforced?: boolean;
  motherName?: string;
  names?: string;
  personId?: number;
  position: string;
  role: string;
  rut?: string;
};
type SetupUserPayload = {
  address?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  bankName?: string;
  fatherName?: string;
  loginEmail?: string;
  motherName?: string;
  names: string;
  password: string;
  phone?: string;
  rut: string;
};
export type { InviteUserPayload, SetupUserPayload };

export async function deleteUser(userId: number): Promise<void> {
  try {
    await usersORPCClient.delete({ id: userId });
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function deleteUserPasskey(userId: number): Promise<void> {
  try {
    await usersORPCClient.deletePasskey({ id: userId });
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    const res = UserProfileResponseSchema.parse(await usersORPCClient.profile({}));
    return res.data as UserProfile;
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function fetchUsers(): Promise<User[]> {
  try {
    const res = UsersResponseSchema.parse(await usersORPCClient.list({}));
    return res.users as User[];
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function inviteUser(
  payload: InviteUserPayload
): Promise<{ tempPassword?: string; userId: number }> {
  try {
    return InviteUserResponseSchema.parse(await usersORPCClient.invite(payload));
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function resetUserPassword(userId: number): Promise<string> {
  try {
    const res = ResetPasswordResponseSchema.parse(
      await usersORPCClient.resetPassword({ id: userId })
    );
    return res.tempPassword;
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function setupUser(payload: SetupUserPayload): Promise<void> {
  try {
    await usersORPCClient.setup(payload);
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function toggleUserMfa(userId: number, enabled: boolean): Promise<void> {
  try {
    const res = StatusResponseSchema.parse(
      await usersORPCClient.toggleMfa({
        enabled,
        id: userId,
      })
    );
    if (res.status !== "ok") {
      throw new Error(res.message || "Error al cambiar estado MFA");
    }
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
  try {
    await usersORPCClient.updateRole({ id: userId, role });
  } catch (error) {
    throw toUsersApiError(error);
  }
}

export async function updateUserStatus(
  userId: number,
  status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED"
): Promise<void> {
  try {
    await usersORPCClient.updateStatus({ id: userId, status });
  } catch (error) {
    throw toUsersApiError(error);
  }
}

const UserProfileUpdatePayloadSchema = z.object({
  address: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountType: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  loginEmail: z.email().nullable().optional(),
  notificationEmail: z.email(),
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
  payload: UserProfileUpdatePayload
): Promise<void> {
  const parsedPayload = UserProfileUpdatePayloadSchema.parse(payload);
  try {
    await usersORPCClient.updateProfile({ id: userId, payload: parsedPayload });
  } catch (error) {
    throw toUsersApiError(error);
  }
}
