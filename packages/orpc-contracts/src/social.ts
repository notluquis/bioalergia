import { oc } from "@orpc/contract";
import { z } from "zod";

// ── Enums (espejo de packages/db/zenstack/schema.zmodel) ──
export const socialNetworkSchema = z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK"]);
export const socialPlacementSchema = z.enum([
  "IG_FEED",
  "IG_REEL",
  "IG_STORY",
  "FB_FEED",
  "FB_REEL",
  "FB_STORY",
  "TIKTOK_VIDEO",
]);
export const socialMediaTypeSchema = z.enum(["IMAGE", "VIDEO", "CAROUSEL"]);
export const socialAspectRatioSchema = z.enum(["RATIO_4_5", "RATIO_1_1", "RATIO_9_16"]);
export const socialPostStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
]);
export const socialTargetStatusSchema = z.enum([
  "PENDING",
  "CREATING",
  "CONTAINER_READY",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "SKIPPED",
]);

// ── Media item (guardado en SocialPost.media Json[]) ──
export const socialMediaItemSchema = z.object({
  key: z.string(),
  url: z.string(),
  type: z.enum(["image", "video"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
});

// ── Outputs ──
export const socialPostTargetSchema = z.object({
  id: z.number().int(),
  postId: z.number().int(),
  accountId: z.number().int(),
  network: socialNetworkSchema,
  placement: socialPlacementSchema,
  status: socialTargetStatusSchema,
  containerId: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  permalink: z.string().nullable().optional(),
  captionOverride: z.string().nullable().optional(),
  attempts: z.number().int(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const socialPostSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable().optional(),
  status: socialPostStatusSchema,
  mediaType: socialMediaTypeSchema,
  aspectRatio: socialAspectRatioSchema,
  caption: z.string().nullable().optional(),
  hashtags: z.array(z.string()),
  media: z.array(socialMediaItemSchema),
  scheduledAt: z.coerce.date().nullable().optional(),
  approvedByUserId: z.number().int().nullable().optional(),
  approvedAt: z.coerce.date().nullable().optional(),
  rejectedReason: z.string().nullable().optional(),
  createdByUserId: z.number().int(),
  publishedAt: z.coerce.date().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  targets: z.array(socialPostTargetSchema).optional(),
});

export const socialAccountSchema = z.object({
  id: z.number().int(),
  provider: z.literal("META"),
  displayName: z.string().nullable().optional(),
  metaBusinessId: z.string().nullable().optional(),
  fbPageId: z.string().nullable().optional(),
  igUserId: z.string().nullable().optional(),
  tokenExpiresAt: z.coerce.date().nullable().optional(),
  graphApiVersion: z.string(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ── Inputs ──
export const socialTargetInputSchema = z.object({
  accountId: z.number().int(),
  network: socialNetworkSchema,
  placement: socialPlacementSchema,
  captionOverride: z.string().optional(),
});

export const createSocialPostInputSchema = z.object({
  title: z.string().optional(),
  mediaType: socialMediaTypeSchema,
  aspectRatio: socialAspectRatioSchema,
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  media: z.array(socialMediaItemSchema).optional(),
  targets: z.array(socialTargetInputSchema).min(1),
  scheduledAt: z.string().optional(),
});

export const updateSocialPostInputSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  media: z.array(socialMediaItemSchema).optional(),
  scheduledAt: z.string().nullable().optional(),
});

export const socialIdInputSchema = z.object({
  id: z.number().int().positive(),
});

export const rejectSocialPostInputSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().min(1),
});

export const scheduleSocialPostInputSchema = z.object({
  id: z.number().int().positive(),
  scheduledAt: z.string().min(1),
});

export const renderSocialPostInputSchema = z.object({
  id: z.number().int().positive(),
  template: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const listSocialPostsInputSchema = z.object({
  status: socialPostStatusSchema.optional(),
});

export const connectMetaAccountInputSchema = z.object({
  displayName: z.string().optional(),
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  shortLivedToken: z.string().min(1),
  igUserId: z.string().optional(),
  fbPageId: z.string().optional(),
});

// ── Responses ──
export const socialPostResponseSchema = z.object({
  post: socialPostSchema,
  status: z.literal("ok"),
});
export const socialPostsResponseSchema = z.object({
  posts: z.array(socialPostSchema),
});
export const socialAccountResponseSchema = z.object({
  account: socialAccountSchema,
  status: z.literal("ok"),
});
export const socialAccountsResponseSchema = z.object({
  accounts: z.array(socialAccountSchema),
});

export const socialSettingsSchema = z.object({
  // dryRun=true simula (no publica a Meta). Config en DB, no env.
  dryRun: z.boolean(),
});
export const socialSettingsResponseSchema = z.object({ settings: socialSettingsSchema });

// ── Meta App config (en DB, no env) ──
// El appSecret NUNCA se devuelve: `hasSecret` indica si ya hay uno guardado.
export const metaConfigSchema = z.object({
  appId: z.string(),
  configId: z.string(),
  graphVersion: z.string(),
  hasSecret: z.boolean(),
});
export const metaConfigResponseSchema = z.object({ config: metaConfigSchema });

export const updateMetaConfigInputSchema = z.object({
  appId: z.string().min(1),
  // Opcional: si viene vacío se conserva el secret existente.
  appSecret: z.string().optional(),
  configId: z.string().min(1),
  graphVersion: z.string().optional(),
});

export const socialContract = {
  getSettings: oc.route({ method: "GET", path: "/settings" }).input(z.object({})).output(socialSettingsResponseSchema),
  updateSettings: oc
    .route({ method: "PUT", path: "/settings" })
    .input(socialSettingsSchema)
    .output(socialSettingsResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).input(listSocialPostsInputSchema).output(socialPostsResponseSchema),
  detail: oc.route({ method: "GET", path: "/{id}" }).input(socialIdInputSchema).output(socialPostResponseSchema),
  create: oc.route({ method: "POST", path: "/" }).input(createSocialPostInputSchema).output(socialPostResponseSchema),
  update: oc.route({ method: "PUT", path: "/{id}" }).input(updateSocialPostInputSchema).output(socialPostResponseSchema),
  approve: oc.route({ method: "POST", path: "/{id}/approve" }).input(socialIdInputSchema).output(socialPostResponseSchema),
  reject: oc
    .route({ method: "POST", path: "/{id}/reject" })
    .input(rejectSocialPostInputSchema)
    .output(socialPostResponseSchema),
  schedule: oc
    .route({ method: "POST", path: "/{id}/schedule" })
    .input(scheduleSocialPostInputSchema)
    .output(socialPostResponseSchema),
  render: oc
    .route({ method: "POST", path: "/{id}/render" })
    .input(renderSocialPostInputSchema)
    .output(socialPostResponseSchema),
  publishNow: oc
    .route({ method: "POST", path: "/{id}/publish" })
    .input(socialIdInputSchema)
    .output(socialPostResponseSchema),
  connectAccount: oc
    .route({ method: "POST", path: "/accounts/connect" })
    .input(connectMetaAccountInputSchema)
    .output(socialAccountResponseSchema),
  listAccounts: oc.route({ method: "GET", path: "/accounts" }).input(z.object({})).output(socialAccountsResponseSchema),
  getMetaConfig: oc.route({ method: "GET", path: "/meta-config" }).input(z.object({})).output(metaConfigResponseSchema),
  updateMetaConfig: oc
    .route({ method: "PUT", path: "/meta-config" })
    .input(updateMetaConfigInputSchema)
    .output(metaConfigResponseSchema),
};

export type SocialContract = typeof socialContract;
