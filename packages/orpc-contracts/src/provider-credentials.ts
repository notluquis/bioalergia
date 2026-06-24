import { oc } from "@orpc/contract";
import { z } from "zod";

import { expenseScopeSchema } from "./expenses.ts";

export const providerKindSchema = z.enum([
  "ESSBIO",
  "CGE",
  "TELSUR",
  "MOVISTAR",
  "DOCTORALIA",
  "MEDIPASS",
  "MASVIDA",
  "PREVIRED",
  "SII",
  "TGR",
  "GASTOS_COMUNES",
  "OTHER",
]);

export const providerAuthMethodSchema = z.enum([
  "NONE_PUBLIC",
  "RUT_PASSWORD",
  "CLAVE_UNICA",
  "CLAVE_TRIBUTARIA",
  "OAUTH",
  "API_KEY",
  "EMAIL_FORWARDING",
]);

export type ProviderKind = z.infer<typeof providerKindSchema>;
export type ProviderAuthMethod = z.infer<typeof providerAuthMethodSchema>;

export const providerCredentialItemSchema = z.object({
  authMethod: providerAuthMethodSchema,
  createdAt: z.coerce.date(),
  id: z.number().int(),
  identifier: z.string(),
  isActive: z.boolean(),
  label: z.string().nullable(),
  lastError: z.string().nullable(),
  lastErrorAt: z.coerce.date().nullable(),
  lastLoginAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  provider: providerKindSchema,
  scope: expenseScopeSchema,
  updatedAt: z.coerce.date(),
  // secret NUNCA se devuelve
});

export const providerCredentialPayloadSchema = z.object({
  authMethod: providerAuthMethodSchema,
  identifier: z.string().min(1),
  isActive: z.boolean().optional(),
  label: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  provider: providerKindSchema,
  scope: expenseScopeSchema.default("PERSONAL"),
  secret: z.string().min(1), // encriptada server-side antes de guardar
});

export const listProviderCredentialsInputSchema = z.object({
  provider: providerKindSchema.optional(),
  scope: expenseScopeSchema.optional(),
});

export const listProviderCredentialsResponseSchema = z.object({
  credentials: z.array(providerCredentialItemSchema),
  status: z.literal("ok"),
});

export const providerCredentialDetailResponseSchema = z.object({
  credential: providerCredentialItemSchema,
  status: z.literal("ok"),
});

export const testCredentialResponseSchema = z.object({
  message: z.string(),
  success: z.boolean(),
});

export const providerCredentialsContract = {
  create: oc
    .route({ method: "POST", path: "/" })
    .input(providerCredentialPayloadSchema)
    .output(providerCredentialDetailResponseSchema),

  delete: oc
    .route({ method: "DELETE", path: "/{id}" })
    .input(z.object({ id: z.number().int() }))
    .output(z.object({ status: z.literal("ok") })),

  list: oc
    .route({ method: "GET", path: "/" })
    .input(listProviderCredentialsInputSchema)
    .output(listProviderCredentialsResponseSchema),

  test: oc
    .route({ method: "POST", path: "/{id}/test" })
    .input(z.object({ id: z.number().int() }))
    .output(testCredentialResponseSchema),

  update: oc
    .route({ method: "PUT", path: "/{id}" })
    .input(
      z.object({
        id: z.number().int(),
        payload: providerCredentialPayloadSchema.partial().extend({
          secret: z.string().optional(), // opcional en update
        }),
      })
    )
    .output(providerCredentialDetailResponseSchema),
};

export type ProviderCredentialsContract = typeof providerCredentialsContract;
