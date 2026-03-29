import { z } from "zod";
import type { startAuthentication, startRegistration } from "@simplewebauthn/browser";

export const AuthUserSchema = z.strictObject({
  email: z.string(),
  hasPasskey: z.boolean().optional(),
  id: z.number(),
  loginEmail: z.string().optional(),
  mfaEnabled: z.boolean().optional(),
  mfaEnforced: z.boolean().optional(),
  name: z.string().nullable(),
  notificationEmail: z.string().optional(),
  roles: z.array(z.string()),
  status: z.string(),
});

// Shape matches RawRuleOf<MongoAbility> from @casl/ability — validated at runtime
const abilityRuleSchema = z.object({
  action: z.union([z.string(), z.array(z.string())]),
  conditions: z.record(z.string(), z.unknown()).optional(),
  fields: z.union([z.string(), z.array(z.string())]).optional(),
  inverted: z.boolean().optional(),
  reason: z.string().optional(),
  subject: z.union([z.string(), z.array(z.string())]).optional(),
});

export const AuthSessionResponseSchema = z.strictObject({
  abilityRules: z.array(abilityRuleSchema).nullable().optional(),
  permissionVersion: z.number().nullable().optional(),
  status: z.string(),
  user: AuthUserSchema.nullable().optional(),
});

export const LoginResponseSchema = z.strictObject({
  abilityRules: z.array(z.unknown()).optional(),
  message: z.string().optional(),
  status: z.string(),
  user: AuthUserSchema.optional(),
  userId: z.number().optional(),
});

export const LoginMfaResponseSchema = z.strictObject({
  abilityRules: z.array(z.unknown()).optional(),
  message: z.string().optional(),
  status: z.string(),
  user: AuthUserSchema.optional(),
});

export const StatusResponseSchema = z.strictObject({
  message: z.string().optional(),
  status: z.string(),
});

export const MfaSetupResponseSchema = z.strictObject({
  message: z.string().optional(),
  qrCodeUrl: z.string(),
  secret: z.string(),
  status: z.string(),
});

const PublicKeyCredentialDescriptorSchema = z.strictObject({
  id: z.string(),
  transports: z.array(z.string()).optional(),
  type: z.string(),
});

export const PasskeyLoginOptionsSchema = z.strictObject({
  allowCredentials: z.array(PublicKeyCredentialDescriptorSchema),
  challenge: z.string(),
  rpId: z.string().optional(),
  timeout: z.number().optional(),
  userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export const PasskeyRegistrationOptionsSchema = z.strictObject({
  attestation: z.string().optional(),
  authenticatorSelection: z
    .strictObject({
      authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
      requireResidentKey: z.boolean().optional(),
      residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
      userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
    })
    .optional(),
  challenge: z.string(),
  excludeCredentials: z.array(PublicKeyCredentialDescriptorSchema).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
  pubKeyCredParams: z.array(
    z.strictObject({
      alg: z.number(),
      type: z.string(),
    })
  ),
  rp: z.strictObject({
    id: z.string().optional(),
    name: z.string(),
  }),
  timeout: z.number().optional(),
  user: z.strictObject({
    displayName: z.string(),
    id: z.string(),
    name: z.string(),
  }),
});

export const PasskeyLoginOptionsResponseSchema = z.union([
  PasskeyLoginOptionsSchema,
  StatusResponseSchema,
]);

export const PasskeyRegistrationOptionsResponseSchema = z.union([
  PasskeyRegistrationOptionsSchema,
  StatusResponseSchema,
]);

// Inferred types from Zod schemas for validation/parsing
export type PasskeyRegistrationOptionsZod = z.infer<typeof PasskeyRegistrationOptionsSchema>;
export type PasskeyLoginOptionsZod = z.infer<typeof PasskeyLoginOptionsSchema>;

// Type-safe types derived from @simplewebauthn/browser function signatures
// These match exactly what startAuthentication/startRegistration expect
export type PasskeyLoginOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];
export type PasskeyRegistrationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
export type PasskeyRegistrationOptionsResponse = PasskeyRegistrationOptions | StatusResponse;
export type PasskeyLoginOptionsResponse = PasskeyLoginOptions | StatusResponse;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
