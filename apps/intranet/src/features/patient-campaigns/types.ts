import type { z } from "zod";
import type {
  patientCampaignRecipientSchema,
  patientCampaignRecipientStatusSchema,
  patientCampaignRecipientWithCampaignSchema,
  patientCampaignSchema,
  patientCampaignStatusCountsSchema,
  patientCampaignWithCountsSchema,
} from "@finanzas/orpc-contracts/patient-campaigns";

export type PatientCampaign = z.infer<typeof patientCampaignSchema>;
export type PatientCampaignWithCounts = z.infer<typeof patientCampaignWithCountsSchema>;
export type PatientCampaignStatusCounts = z.infer<typeof patientCampaignStatusCountsSchema>;
export type PatientCampaignRecipient = z.infer<typeof patientCampaignRecipientSchema>;
export type PatientCampaignRecipientWithCampaign = z.infer<
  typeof patientCampaignRecipientWithCampaignSchema
>;
export type PatientCampaignRecipientStatus = z.infer<typeof patientCampaignRecipientStatusSchema>;

export const PATIENT_CAMPAIGN_STATUSES: PatientCampaignRecipientStatus[] = [
  "PENDING",
  "SENT",
  "INFO_REQUESTED",
  "IN_NEGOTIATION",
  "ACCEPTED",
  "DISMISSED",
  "NO_RESPONSE",
];

export const PATIENT_CAMPAIGN_STATUS_LABELS: Record<PatientCampaignRecipientStatus, string> = {
  PENDING: "Pendiente",
  SENT: "Enviado",
  INFO_REQUESTED: "Pidió información",
  IN_NEGOTIATION: "En conversación",
  ACCEPTED: "Aceptó",
  DISMISSED: "Desestimó",
  NO_RESPONSE: "Sin respuesta",
};

export const PATIENT_CAMPAIGN_STATUS_COLORS: Record<
  PatientCampaignRecipientStatus,
  "accent" | "danger" | "default" | "success" | "warning"
> = {
  PENDING: "default",
  SENT: "accent",
  INFO_REQUESTED: "accent",
  IN_NEGOTIATION: "warning",
  ACCEPTED: "success",
  DISMISSED: "danger",
  NO_RESPONSE: "default",
};
