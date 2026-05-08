import { oc } from "@orpc/contract";
import { z } from "zod";

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "PENDING_SETUP", "SUSPENDED"]);

export const usersListInputSchema = z.object({
  includeTest: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  email: z.email("Email inválido"),
  role: z.string().min(1, "Rol requerido"),
  position: z.string().min(1, "Cargo requerido"),
  mfaEnforced: z.boolean().optional().default(true),
  personId: z.number().int().optional(),
  names: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  rut: z.string().optional(),
});

export const setupUserSchema = z.object({
  names: z.string().min(1),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  loginEmail: z.email("Email de login inválido").optional(),
  rut: z.string().min(1),
  phone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountType: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const userIdSchema = z.object({
  id: z.number().int(),
});

export const updateStatusSchema = z.object({
  id: z.number().int(),
  status: z.enum(["ACTIVE", "PENDING_SETUP", "SUSPENDED"]),
});

export const updateRoleSchema = z.object({
  id: z.number().int(),
  role: z.string().min(1, "Rol requerido"),
});

export const toggleMfaSchema = z.object({
  enabled: z.boolean(),
  id: z.number().int(),
});

export const updateUserProfileSchema = z
  .object({
    bankAccountNumber: z.string().max(120).nullable().optional(),
    bankAccountType: z.string().max(80).nullable().optional(),
    bankName: z.string().max(120).nullable().optional(),
    department: z.string().max(120).nullable().optional(),
    email: z.email("Email inválido").optional(),
    fatherName: z.string().max(120).nullable().optional(),
    loginEmail: z.email("Email de login inválido").nullable().optional(),
    mfaEnforced: z.boolean().optional(),
    motherName: z.string().max(120).nullable().optional(),
    names: z.string().min(1, "Nombres requeridos").max(160),
    notificationEmail: z.email("Email de notificación inválido").optional(),
    phone: z.string().max(60).nullable().optional(),
    position: z.string().min(1, "Cargo requerido").max(120),
    rut: z.string().min(1, "RUT requerido").max(20),
  })
  .superRefine((value, ctx) => {
    if (!value.notificationEmail && !value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "notificationEmail es requerido",
        path: ["notificationEmail"],
      });
    }
  });

export const userPersonSchema = z.object({
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  names: z.string(),
  phone: z.string().nullable(),
  rut: z.string(),
});

export const userEmployeeSchema = z.object({
  bankAccountNumber: z.string().nullable(),
  bankAccountType: z.string().nullable(),
  bankName: z.string().nullable(),
  department: z.string().nullable(),
  position: z.string(),
});

export const userListItemSchema = z.object({
  createdAt: z.date(),
  email: z.string(),
  employee: userEmployeeSchema.nullable(),
  hasPasskey: z.boolean(),
  id: z.number().int(),
  loginEmail: z.string(),
  mfaEnabled: z.boolean(),
  mfaEnforced: z.boolean(),
  notificationEmail: z.string(),
  passkeysCount: z.number().int(),
  person: userPersonSchema.nullable(),
  role: z.string(),
  status: userStatusSchema,
});

export const userProfileSchema = z.object({
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountType: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  email: z.string(),
  fatherName: z.string().nullable().optional(),
  id: z.number().int(),
  loginEmail: z.string(),
  motherName: z.string().nullable().optional(),
  names: z.string(),
  notificationEmail: z.string().optional(),
  phone: z.string().nullable().optional(),
  rut: z.string(),
});

export const usersResponseSchema = z.object({
  status: z.literal("ok"),
  users: z.array(userListItemSchema),
});

export const userProfileResponseSchema = z.object({
  data: userProfileSchema,
  status: z.literal("ok"),
});

export const inviteResponseSchema = z.object({
  status: z.literal("ok"),
  tempPassword: z.string().optional(),
  userId: z.number().int(),
});

export const resetPasswordResponseSchema = z.object({
  status: z.literal("ok"),
  tempPassword: z.string(),
});

export const toggleMfaResponseSchema = z.object({
  mfaEnabled: z.boolean(),
  status: z.literal("ok"),
});

export const usersStatusResponseSchema = z.object({
  message: z.string().optional(),
  status: z.literal("ok"),
});

export const usersContract = {
  delete: oc.route({ method: "DELETE", path: "/{id}" }).input(userIdSchema).output(usersStatusResponseSchema),
  deletePasskey: oc
    .route({ method: "DELETE", path: "/{id}/passkey" })
    .input(userIdSchema)
    .output(usersStatusResponseSchema),
  invite: oc.route({ method: "POST", path: "/invite" }).input(inviteUserSchema).output(inviteResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).input(usersListInputSchema).output(usersResponseSchema),
  profile: oc.route({ method: "GET", path: "/profile" }).input(z.object({})).output(userProfileResponseSchema),
  resetPassword: oc
    .route({ method: "POST", path: "/{id}/reset-password" })
    .input(userIdSchema)
    .output(resetPasswordResponseSchema),
  setup: oc.route({ method: "POST", path: "/setup" }).input(setupUserSchema).output(usersStatusResponseSchema),
  toggleMfa: oc
    .route({ method: "POST", path: "/{id}/mfa" })
    .input(toggleMfaSchema)
    .output(toggleMfaResponseSchema),
  updateProfile: oc
    .route({ method: "PUT", path: "/{id}/profile" })
    .input(z.object({ id: z.number().int(), payload: updateUserProfileSchema }))
    .output(usersStatusResponseSchema),
  updateRole: oc
    .route({ method: "PUT", path: "/{id}/role" })
    .input(updateRoleSchema)
    .output(usersStatusResponseSchema),
  updateStatus: oc
    .route({ method: "PUT", path: "/{id}/status" })
    .input(updateStatusSchema)
    .output(usersStatusResponseSchema),
};

export type UsersContract = typeof usersContract;
