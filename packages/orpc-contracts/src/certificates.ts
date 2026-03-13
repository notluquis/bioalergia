import { oc } from "@orpc/contract";
import { z } from "zod";

export const certificateVerifyInputSchema = z.object({
  id: z.string().min(1),
});

export const certificateVerifyResponseSchema = z.union([
  z.object({
    diagnosis: z.string(),
    doctor: z.object({
      name: z.string(),
      specialty: z.string().optional(),
    }),
    issuedAt: z.coerce.date(),
    patient: z.object({
      name: z.string(),
    }),
    purpose: z.string(),
    restDays: z.number().nullable().optional(),
    restEndDate: z.coerce.date().nullable().optional(),
    restStartDate: z.coerce.date().nullable().optional(),
    valid: z.literal(true),
  }),
  z.object({
    error: z.string().optional(),
    valid: z.literal(false),
  }),
]);

export const certificatesContract = {
  verify: oc
    .route({ method: "GET", path: "/verify/{id}" })
    .input(certificateVerifyInputSchema)
    .output(certificateVerifyResponseSchema),
};

export type CertificatesContract = typeof certificatesContract;
