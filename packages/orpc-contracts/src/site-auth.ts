import { oc } from "@orpc/contract";
import { z } from "zod";

// Public-shop authentication (separate cookie + subdomain from intranet).
// Backs the /mi-cuenta flow on bioalergia.cl. Reuses the Person/User table
// shared with the intranet; matching is by normalized email.

const rutSchema = z
  .string()
  .regex(/^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/, "RUT inválido")
  .optional();

export const siteAuthRequestMagicLinkInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).optional(),
});

export const siteAuthMagicLinkStatusSchema = z.object({
  status: z.literal("ok"),
});

export const siteAuthConsumeMagicLinkInputSchema = z.object({
  token: z.string().min(8),
});

export const siteAuthUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  name: z.string().nullable(),
  has_password: z.boolean(),
  passkey_count: z.number().int().nonnegative(),
  mfa_enabled: z.boolean(),
});

export const siteAuthSessionResponseSchema = z.object({
  status: z.literal("ok"),
  user: siteAuthUserSchema.nullable(),
});

export const siteAuthLoginPasswordInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const siteAuthLoginResponseSchema = z.object({
  status: z.literal("ok"),
  user: siteAuthUserSchema,
});

export const siteAuthRegisterPasswordInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  rut: rutSchema,
});

export const siteAuthSetPasswordInputSchema = z.object({
  currentPassword: z.string().min(8).optional(),
  newPassword: z.string().min(8),
});

export const siteAuthStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const siteAuthPasskeyOptionsResponseSchema = z.object({
  status: z.literal("ok"),
  options: z.unknown(), // PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON
});

export const siteAuthPasskeyVerifyInputSchema = z.object({
  challenge: z.string(),
  body: z.unknown(),
  friendlyName: z.string().optional(),
});

export const siteAuthPasskeyLoginVerifyInputSchema = z.object({
  challenge: z.string(),
  body: z.unknown(),
});

export const siteAuthPasskeyListResponseSchema = z.object({
  status: z.literal("ok"),
  data: z.array(
    z.object({
      id: z.string(),
      friendly_name: z.string(),
      created_at: z.string(),
      last_used_at: z.string().nullable(),
    })
  ),
});

export const siteAuthPasskeyDeleteInputSchema = z.object({
  passkey_id: z.string().min(1),
});

export const siteAuthContract = {
  requestMagicLink: oc
    .route({ method: "POST", path: "/magic-link/request" })
    .input(siteAuthRequestMagicLinkInputSchema)
    .output(siteAuthMagicLinkStatusSchema),
  consumeMagicLink: oc
    .route({ method: "POST", path: "/magic-link/consume" })
    .input(siteAuthConsumeMagicLinkInputSchema)
    .output(siteAuthLoginResponseSchema),
  loginWithPassword: oc
    .route({ method: "POST", path: "/login" })
    .input(siteAuthLoginPasswordInputSchema)
    .output(siteAuthLoginResponseSchema),
  registerWithPassword: oc
    .route({ method: "POST", path: "/register" })
    .input(siteAuthRegisterPasswordInputSchema)
    .output(siteAuthLoginResponseSchema),
  logout: oc.route({ method: "POST", path: "/logout" }).output(siteAuthStatusResponseSchema),
  me: oc.route({ method: "GET", path: "/me" }).output(siteAuthSessionResponseSchema),
  setPassword: oc
    .route({ method: "POST", path: "/set-password" })
    .input(siteAuthSetPasswordInputSchema)
    .output(siteAuthStatusResponseSchema),
  passkeyRegisterOptions: oc
    .route({ method: "GET", path: "/passkey/register/options" })
    .output(siteAuthPasskeyOptionsResponseSchema),
  passkeyRegisterVerify: oc
    .route({ method: "POST", path: "/passkey/register/verify" })
    .input(siteAuthPasskeyVerifyInputSchema)
    .output(siteAuthStatusResponseSchema),
  passkeyLoginOptions: oc
    .route({ method: "GET", path: "/passkey/login/options" })
    .output(siteAuthPasskeyOptionsResponseSchema),
  passkeyLoginVerify: oc
    .route({ method: "POST", path: "/passkey/login/verify" })
    .input(siteAuthPasskeyLoginVerifyInputSchema)
    .output(siteAuthLoginResponseSchema),
  passkeyList: oc
    .route({ method: "GET", path: "/passkey/list" })
    .output(siteAuthPasskeyListResponseSchema),
  passkeyDelete: oc
    .route({ method: "POST", path: "/passkey/delete" })
    .input(siteAuthPasskeyDeleteInputSchema)
    .output(siteAuthStatusResponseSchema),
};

export type SiteAuthContract = typeof siteAuthContract;
