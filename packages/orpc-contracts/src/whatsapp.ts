import { oc } from "@orpc/contract";
import { z } from "zod";

export const whatsappNotificationStatusSchema = z.enum([
  "PENDING",
  "SENT",
  "FAILED",
  "DELIVERED",
  "READ",
]);

export const whatsappNotificationSchema = z.object({
  id: z.string(),
  patientName: z.string(),
  patientPhone: z.string(),
  patientEmail: z.string().nullable().optional(),
  appointmentDate: z.coerce.date().nullable().optional(),
  appointmentService: z.string().nullable().optional(),
  appointmentDoctor: z.string().nullable().optional(),
  emailMessageId: z.string(),
  waMessageId: z.string().nullable().optional(),
  status: whatsappNotificationStatusSchema,
  errorMessage: z.string().nullable().optional(),
  sentAt: z.coerce.date().nullable().optional(),
  deliveredAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const listWhatsappNotificationsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  status: whatsappNotificationStatusSchema.optional(),
});

export const listWhatsappNotificationsResponseSchema = z.object({
  notifications: z.array(whatsappNotificationSchema),
  total: z.number(),
});

export const whatsappStatsSchema = z.object({
  pending: z.number(),
  sent: z.number(),
  failed: z.number(),
  delivered: z.number(),
  read: z.number(),
  total: z.number(),
});

export const whatsappTestSendInputSchema = z.object({
  phone: z.string().min(5),
});

export const whatsappStatusResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  message: z.string(),
});

export const whatsappContract = {
  listNotifications: oc
    .route({
      method: "GET",
      path: "/notifications",
      summary: "List WhatsApp notifications",
      tags: ["WhatsApp"],
    })
    .input(listWhatsappNotificationsInputSchema)
    .output(listWhatsappNotificationsResponseSchema),

  getStats: oc
    .route({
      method: "GET",
      path: "/stats",
      summary: "Get WhatsApp notification stats",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatsSchema),

  testSend: oc
    .route({
      method: "POST",
      path: "/test-send",
      summary: "Send a test WhatsApp message",
      tags: ["WhatsApp"],
    })
    .input(whatsappTestSendInputSchema)
    .output(whatsappStatusResponseSchema),

  triggerPoll: oc
    .route({
      method: "POST",
      path: "/trigger-poll",
      summary: "Manually trigger IMAP poll for Doctoralia emails",
      tags: ["WhatsApp"],
    })
    .output(whatsappStatusResponseSchema),
};

export type WhatsappContract = typeof whatsappContract;
