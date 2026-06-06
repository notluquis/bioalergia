import { oc } from "@orpc/contract";
import { z } from "zod";

export const jobApplicationStatusSchema = z.enum([
  "NEW",
  "SEEN",
  "INTERESTED",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "DISCARDED",
]);

export const jobPostingStatusSchema = z.enum(["OPEN", "CLOSED"]);

export const jobPostingSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    company: z.string(),
    externalId: z.string(),
    title: z.string(),
    url: z.string(),
    department: z.string().nullable(),
    location: z.string().nullable(),
    remote: z.string().nullable(),
    descriptionHtml: z.string().nullable(),
    publishedAt: z.date().nullable(),
    lastmod: z.date().nullable(),
    status: jobPostingStatusSchema,
    notified: z.boolean(),
    matched: z.boolean(),
    applicationStatus: jobApplicationStatusSchema,
    appliedAt: z.date().nullable(),
    statusUpdatedAt: z.date().nullable(),
    notes: z.string().nullable(),
    firstSeenAt: z.date(),
    lastSeenAt: z.date(),
  })
  .passthrough();

export const jobRadarListInputSchema = z
  .object({
    postingStatus: z.enum(["OPEN", "CLOSED", "ALL"]).optional(),
    applicationStatus: jobApplicationStatusSchema.optional(),
    source: z.string().optional(),
    search: z.string().optional(),
  })
  .optional();

export const jobRadarUpdateInputSchema = z.object({
  id: z.string().min(1),
  applicationStatus: jobApplicationStatusSchema.optional(),
  notes: z.string().nullable().optional(),
});

export const jobRadarSyncResultSchema = z.object({
  sources: z.array(z.string()),
  fetched: z.number().int(),
  inserted: z.number().int(),
  updated: z.number().int(),
  closed: z.number().int(),
  notified: z.number().int(),
});

export const jobRadarSettingsSchema = z.object({
  enabled: z.boolean(),
  bci: z.boolean(),
  getonbrd: z.boolean(),
  keywords: z.string(),
  departments: z.string(),
  cron: z.string(),
  telegramBotToken: z.string(),
  telegramChatId: z.string(),
});

export const jobRadarSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  bci: z.boolean().optional(),
  getonbrd: z.boolean().optional(),
  keywords: z.string().optional(),
  departments: z.string().optional(),
  cron: z.string().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
});

export const jobSourceKindSchema = z.enum([
  "TEAMTAILOR",
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
  "SMARTRECRUITERS",
  "WORKDAY",
  "AIRAVIRTUAL",
]);

export const jobSourceSchema = z
  .object({
    id: z.string(),
    kind: jobSourceKindSchema,
    identifier: z.string(),
    label: z.string().nullable(),
    enabled: z.boolean(),
    createdAt: z.date(),
  })
  .passthrough();

export const jobSourceAddInputSchema = z.object({
  kind: jobSourceKindSchema,
  identifier: z.string().min(1),
  label: z.string().nullable().optional(),
});

export const jobSourceToggleInputSchema = z.object({ id: z.string().min(1), enabled: z.boolean() });
export const jobSourceIdInputSchema = z.object({ id: z.string().min(1) });

export const jobRadarContract = {
  list: oc
    .route({ method: "GET", path: "/postings" })
    .input(jobRadarListInputSchema)
    .output(z.array(jobPostingSchema)),
  update: oc
    .route({ method: "PATCH", path: "/postings/{id}" })
    .input(jobRadarUpdateInputSchema)
    .output(jobPostingSchema),
  syncNow: oc.route({ method: "POST", path: "/sync" }).output(jobRadarSyncResultSchema),
  getSettings: oc.route({ method: "GET", path: "/settings" }).output(jobRadarSettingsSchema),
  updateSettings: oc
    .route({ method: "PATCH", path: "/settings" })
    .input(jobRadarSettingsUpdateSchema)
    .output(jobRadarSettingsSchema),
  listSources: oc.route({ method: "GET", path: "/sources" }).output(z.array(jobSourceSchema)),
  addSource: oc
    .route({ method: "POST", path: "/sources" })
    .input(jobSourceAddInputSchema)
    .output(jobSourceSchema),
  toggleSource: oc
    .route({ method: "PATCH", path: "/sources/{id}" })
    .input(jobSourceToggleInputSchema)
    .output(jobSourceSchema),
  deleteSource: oc
    .route({ method: "DELETE", path: "/sources/{id}" })
    .input(jobSourceIdInputSchema)
    .output(z.object({ id: z.string() })),
};

export type JobRadarContract = typeof jobRadarContract;
export type JobPostingDTO = z.output<typeof jobPostingSchema>;
export type JobApplicationStatus = z.infer<typeof jobApplicationStatusSchema>;
export type JobRadarSettings = z.output<typeof jobRadarSettingsSchema>;
export type JobSourceDTO = z.output<typeof jobSourceSchema>;
export type JobSourceKind = z.infer<typeof jobSourceKindSchema>;
