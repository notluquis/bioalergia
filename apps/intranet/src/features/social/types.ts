import { z } from "zod";
import type {
  socialAccountSchema,
  socialAspectRatioSchema,
  socialMediaItemSchema,
  socialMediaTypeSchema,
  socialNetworkSchema,
  socialPlacementSchema,
  socialPostSchema,
  socialPostStatusSchema,
  socialPostTargetSchema,
  socialTargetStatusSchema,
} from "@finanzas/orpc-contracts/social";

export type SocialPost = z.infer<typeof socialPostSchema>;
export type SocialPostTarget = z.infer<typeof socialPostTargetSchema>;
export type SocialAccount = z.infer<typeof socialAccountSchema>;
export type SocialMediaItem = z.infer<typeof socialMediaItemSchema>;
export type SocialPostStatus = z.infer<typeof socialPostStatusSchema>;
export type SocialTargetStatus = z.infer<typeof socialTargetStatusSchema>;
export type SocialNetwork = z.infer<typeof socialNetworkSchema>;
export type SocialPlacement = z.infer<typeof socialPlacementSchema>;
export type SocialMediaType = z.infer<typeof socialMediaTypeSchema>;
export type SocialAspectRatio = z.infer<typeof socialAspectRatioSchema>;

export const socialTabKey = z.enum(["calendario", "pendientes", "publicados", "cuentas"]);
export type SocialTab = z.infer<typeof socialTabKey>;

type ChipColor = "accent" | "danger" | "default" | "success" | "warning";

export const SOCIAL_POST_STATUSES: SocialPostStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
];

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente de aprobación",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falló",
};

export const SOCIAL_POST_STATUS_COLORS: Record<SocialPostStatus, ChipColor> = {
  DRAFT: "default",
  PENDING_APPROVAL: "warning",
  SCHEDULED: "accent",
  PUBLISHING: "accent",
  PUBLISHED: "success",
  FAILED: "danger",
};

export const SOCIAL_TARGET_STATUS_LABELS: Record<SocialTargetStatus, string> = {
  PENDING: "Pendiente",
  CREATING: "Creando",
  CONTAINER_READY: "Contenedor listo",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falló",
  SKIPPED: "Omitido",
};

export const SOCIAL_TARGET_STATUS_COLORS: Record<SocialTargetStatus, ChipColor> = {
  PENDING: "default",
  CREATING: "accent",
  CONTAINER_READY: "accent",
  PUBLISHING: "accent",
  PUBLISHED: "success",
  FAILED: "danger",
  SKIPPED: "default",
};

export const SOCIAL_NETWORK_LABELS: Record<SocialNetwork, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
};

export const SOCIAL_PLACEMENT_LABELS: Record<SocialPlacement, string> = {
  IG_FEED: "IG Feed",
  IG_REEL: "IG Reel",
  IG_STORY: "IG Story",
  FB_FEED: "FB Feed",
  FB_REEL: "FB Reel",
  FB_STORY: "FB Story",
  TIKTOK_VIDEO: "TikTok Video",
};

export const SOCIAL_MEDIA_TYPE_LABELS: Record<SocialMediaType, string> = {
  IMAGE: "Imagen",
  VIDEO: "Video",
  CAROUSEL: "Carrusel",
};

export const SOCIAL_ASPECT_RATIO_LABELS: Record<SocialAspectRatio, string> = {
  RATIO_4_5: "4:5 (vertical feed)",
  RATIO_1_1: "1:1 (cuadrado)",
  RATIO_9_16: "9:16 (story/reel)",
};

/** Placements available per network — used to filter the create form picker. */
export const PLACEMENTS_BY_NETWORK: Record<SocialNetwork, SocialPlacement[]> = {
  INSTAGRAM: ["IG_FEED", "IG_REEL", "IG_STORY"],
  FACEBOOK: ["FB_FEED", "FB_REEL", "FB_STORY"],
  TIKTOK: ["TIKTOK_VIDEO"],
};
