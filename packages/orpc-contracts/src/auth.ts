import { oc } from "@orpc/contract";
import { z } from "zod";

export const authLoginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const authMfaLoginSchema = z.object({
  token: z.string().min(6, "Token inválido"),
  userId: z.number().int(),
});

export const authMfaEnableSchema = z.object({
  token: z.string().min(6, "Token inválido"),
});

export const authPasskeyVerifySchema = z.object({
  body: z.record(z.string(), z.unknown()),
  challenge: z.string().min(1),
});

export const authPasskeyResponseSchema = z.object({
  body: z.record(z.string(), z.unknown()),
  challenge: z.string().min(1),
});

export const authEmptySchema = z.object({});

export const authUserSchema = z.object({
  email: z.string(),
  hasPasskey: z.boolean().optional(),
  id: z.number().int(),
  loginEmail: z.string().optional(),
  mfaEnabled: z.boolean().optional(),
  mfaEnforced: z.boolean().optional(),
  name: z.string().nullable(),
  notificationEmail: z.string().optional(),
  roles: z.array(z.string()),
  status: z.string(),
});

export const authLoginOkResponseSchema = z.object({
  abilityRules: z.array(z.unknown()),
  status: z.literal("ok"),
  user: authUserSchema,
});

export const authLoginMfaRequiredResponseSchema = z.object({
  status: z.literal("mfa_required"),
  userId: z.number().int(),
});

export const authLoginResponseSchema = z.union([
  authLoginOkResponseSchema,
  authLoginMfaRequiredResponseSchema,
]);

export const authSessionResponseSchema = z.object({
  abilityRules: z.array(z.unknown()).optional(),
  permissionVersion: z.number().optional(),
  status: z.literal("ok"),
  user: authUserSchema.nullable(),
});

export const authStatusResponseSchema = z.object({
  message: z.string().optional(),
  status: z.literal("ok"),
});

export const authDebugAudienceSchema = z.enum(["debug-cli", "debug-playwright"]);

export const authDebugScopeSchema = z.object({
  action: z.string().min(1),
  subject: z.string().min(1),
});

export const authIssueDebugTokenSchema = z.object({
  audience: authDebugAudienceSchema,
  expiresInMinutes: z.number().int().min(1).max(15).optional(),
  reason: z.string().min(3).max(200),
  scopes: z.array(authDebugScopeSchema).min(1).max(20),
  targetUserId: z.number().int(),
});

export const authIssueDebugTokenResponseSchema = z.object({
  expiresAt: z.string(),
  jti: z.string(),
  status: z.literal("ok"),
  token: z.string(),
});

export const authExchangeDebugTokenSchema = z.object({
  delivery: z.enum(["bearer", "cookie"]).optional(),
  token: z.string().min(1),
});

export const authExchangeDebugTokenResponseSchema = z.object({
  accessToken: z.string().optional(),
  delivery: z.enum(["bearer", "cookie"]),
  expiresAt: z.string(),
  status: z.literal("ok"),
  user: authUserSchema,
});

export const authMfaSetupResponseSchema = z.object({
  qrCodeUrl: z.string(),
  secret: z.string(),
  status: z.literal("ok"),
});

export const authPublicKeyCredentialDescriptorSchema = z.object({
  id: z.string(),
  transports: z.array(z.string()).optional(),
  type: z.string(),
});

export const authPasskeyLoginOptionsSchema = z.object({
  allowCredentials: z.array(authPublicKeyCredentialDescriptorSchema),
  challenge: z.string(),
  extensions: z.record(z.string(), z.unknown()).optional(),
  rpId: z.string().optional(),
  timeout: z.number().optional(),
  userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
});

export const authPasskeyRegistrationOptionsSchema = z.object({
  attestation: z.string().optional(),
  authenticatorSelection: z
    .object({
      authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
      requireResidentKey: z.boolean().optional(),
      residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
      userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
    })
    .optional(),
  challenge: z.string(),
  excludeCredentials: z.array(authPublicKeyCredentialDescriptorSchema).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
  pubKeyCredParams: z.array(
    z.object({
      alg: z.number(),
      type: z.string(),
    })
  ),
  rp: z.object({
    id: z.string().optional(),
    name: z.string(),
  }),
  timeout: z.number().optional(),
  user: z.object({
    displayName: z.string(),
    id: z.string(),
    name: z.string(),
  }),
});

export const authContract = {
  login: oc
    .route({ method: "POST", path: "/login" })
    .input(authLoginSchema)
    .output(authLoginResponseSchema),
  loginMfa: oc
    .route({ method: "POST", path: "/login/mfa" })
    .input(authMfaLoginSchema)
    .output(authLoginOkResponseSchema),
  logout: oc
    .route({ method: "POST", path: "/logout" })
    .input(authEmptySchema)
    .output(authStatusResponseSchema),
  session: oc.route({ method: "GET", path: "/me/session" }).output(authSessionResponseSchema),
  issueDebugToken: oc
    .route({ method: "POST", path: "/debug/token" })
    .input(authIssueDebugTokenSchema)
    .output(authIssueDebugTokenResponseSchema),
  exchangeDebugToken: oc
    .route({ method: "POST", path: "/debug/exchange" })
    .input(authExchangeDebugTokenSchema)
    .output(authExchangeDebugTokenResponseSchema),
  mfaDisable: oc
    .route({ method: "POST", path: "/mfa/disable" })
    .input(authEmptySchema)
    .output(authStatusResponseSchema),
  mfaEnable: oc
    .route({ method: "POST", path: "/mfa/enable" })
    .input(authMfaEnableSchema)
    .output(authStatusResponseSchema),
  mfaSetup: oc
    .route({ method: "POST", path: "/mfa/setup" })
    .input(authEmptySchema)
    .output(authMfaSetupResponseSchema),
  passkeyLoginOptions: oc
    .route({ method: "GET", path: "/passkey/login/options" })
    .output(authPasskeyLoginOptionsSchema),
  passkeyLoginVerify: oc
    .route({ method: "POST", path: "/passkey/login/verify" })
    .input(authPasskeyVerifySchema)
    .output(authLoginOkResponseSchema),
  passkeyRegisterOptions: oc
    .route({ method: "GET", path: "/passkey/register/options" })
    .output(authPasskeyRegistrationOptionsSchema),
  passkeyRegisterVerify: oc
    .route({ method: "POST", path: "/passkey/register/verify" })
    .input(authPasskeyResponseSchema)
    .output(authStatusResponseSchema),
  passkeyRemove: oc
    .route({ method: "DELETE", path: "/passkey/remove" })
    .input(authEmptySchema)
    .output(authStatusResponseSchema),
};

export type AuthContract = typeof authContract;
