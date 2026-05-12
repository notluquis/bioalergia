import { oc } from "@orpc/contract";
import { z } from "zod";

export const patientCampaignRecipientStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "INFO_REQUESTED",
  "IN_NEGOTIATION",
  "ACCEPTED",
  "DISMISSED",
  "NO_RESPONSE",
]);

export type PatientCampaignRecipientStatus = z.infer<typeof patientCampaignRecipientStatusSchema>;

export const patientCampaignSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  messageTemplate: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdBy: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const patientCampaignStatusCountsSchema = z.object({
  PENDING: z.number().int().default(0),
  SENT: z.number().int().default(0),
  INFO_REQUESTED: z.number().int().default(0),
  IN_NEGOTIATION: z.number().int().default(0),
  ACCEPTED: z.number().int().default(0),
  DISMISSED: z.number().int().default(0),
  NO_RESPONSE: z.number().int().default(0),
});

export const patientCampaignWithCountsSchema = patientCampaignSchema.extend({
  totalRecipients: z.number().int(),
  statusCounts: patientCampaignStatusCountsSchema,
});

export const patientCampaignRecipientSchema = z.object({
  id: z.number().int(),
  campaignId: z.number().int(),
  patientRut: z.string(),
  patientName: z.string().nullable(),
  patientPhone: z.string().nullable(),
  status: patientCampaignRecipientStatusSchema,
  notes: z.string().nullable(),
  sentAt: z.coerce.date().nullable(),
  respondedAt: z.coerce.date().nullable(),
  updatedBy: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const patientCampaignRecipientWithCampaignSchema = patientCampaignRecipientSchema.extend({
  campaign: patientCampaignSchema,
});

// ── Inputs ───────────────────────────────────────────────────────────────────

export const createPatientCampaignInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  messageTemplate: z.string().max(10000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updatePatientCampaignInputSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  messageTemplate: z.string().max(10000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const patientCampaignIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const listPatientCampaignsInputSchema = z.object({
  includeInactive: z.boolean().optional(),
});

export const listCampaignRecipientsInputSchema = z.object({
  campaignId: z.number().int().positive(),
  status: patientCampaignRecipientStatusSchema.optional(),
  query: z.string().optional(),
});

export const upsertCampaignRecipientInputSchema = z.object({
  campaignId: z.number().int().positive(),
  patientRut: z.string().min(1).max(20),
  patientName: z.string().max(200).optional(),
  patientPhone: z.string().max(50).optional(),
  status: patientCampaignRecipientStatusSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const updateRecipientStatusInputSchema = z.object({
  id: z.number().int().positive(),
  status: patientCampaignRecipientStatusSchema,
  notes: z.string().max(2000).optional(),
});

export const deleteRecipientInputSchema = z.object({
  id: z.number().int().positive(),
});

export const listRecipientsByPatientInputSchema = z.object({
  patientRut: z.string().min(1).max(20),
});

// ── Outputs ──────────────────────────────────────────────────────────────────

export const patientCampaignsListResponseSchema = z.object({
  campaigns: z.array(patientCampaignWithCountsSchema),
});

export const patientCampaignResponseSchema = z.object({
  campaign: patientCampaignWithCountsSchema,
});

export const patientCampaignRecipientsResponseSchema = z.object({
  recipients: z.array(patientCampaignRecipientSchema),
});

export const patientCampaignRecipientResponseSchema = z.object({
  recipient: patientCampaignRecipientSchema,
});

export const patientRecipientsByPatientResponseSchema = z.object({
  recipients: z.array(patientCampaignRecipientWithCampaignSchema),
});

export const patientCampaignStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

// ── Contract ─────────────────────────────────────────────────────────────────

export const patientCampaignsContract = {
  listCampaigns: oc
    .route({ method: "GET", path: "/", tags: ["Patient Campaigns"] })
    .input(listPatientCampaignsInputSchema)
    .output(patientCampaignsListResponseSchema),
  getCampaign: oc
    .route({ method: "GET", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(patientCampaignIdInputSchema)
    .output(patientCampaignResponseSchema),
  createCampaign: oc
    .route({ method: "POST", path: "/", tags: ["Patient Campaigns"] })
    .input(createPatientCampaignInputSchema)
    .output(patientCampaignResponseSchema),
  updateCampaign: oc
    .route({ method: "PUT", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(updatePatientCampaignInputSchema)
    .output(patientCampaignResponseSchema),
  deleteCampaign: oc
    .route({ method: "DELETE", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(patientCampaignIdInputSchema)
    .output(patientCampaignStatusResponseSchema),
  listRecipients: oc
    .route({ method: "GET", path: "/{campaignId}/recipients", tags: ["Patient Campaigns"] })
    .input(listCampaignRecipientsInputSchema)
    .output(patientCampaignRecipientsResponseSchema),
  upsertRecipient: oc
    .route({ method: "POST", path: "/recipients", tags: ["Patient Campaigns"] })
    .input(upsertCampaignRecipientInputSchema)
    .output(patientCampaignRecipientResponseSchema),
  updateRecipientStatus: oc
    .route({ method: "PUT", path: "/recipients/{id}", tags: ["Patient Campaigns"] })
    .input(updateRecipientStatusInputSchema)
    .output(patientCampaignRecipientResponseSchema),
  deleteRecipient: oc
    .route({ method: "DELETE", path: "/recipients/{id}", tags: ["Patient Campaigns"] })
    .input(deleteRecipientInputSchema)
    .output(patientCampaignStatusResponseSchema),
  listByPatient: oc
    .route({ method: "GET", path: "/by-patient", tags: ["Patient Campaigns"] })
    .input(listRecipientsByPatientInputSchema)
    .output(patientRecipientsByPatientResponseSchema),
};

export type PatientCampaignsContract = typeof patientCampaignsContract;
