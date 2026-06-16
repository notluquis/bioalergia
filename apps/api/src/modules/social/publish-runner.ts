// State machine de publicación social (espejo liviano de wa-cloud/broadcast-runner).
//
// Fase A (SOCIAL_PUBLISH_DRYRUN != "false", default): simula la publicación en
// una vuelta para ejercitar generar→aprobar→agendar→publicar sin App Review.
// Fase B (DRYRUN="false"): flujo real del Graph API — IG por container de 3 pasos
// (create → poll FINISHED → media_publish) drenado por el tick; FB síncrono.

import { db } from "@finanzas/db";

import { logEvent } from "../../lib/logger.ts";
import { getSocialDryRun } from "../../lib/social-settings.ts";
import { loadSocialAccount } from "./graph/_http.ts";
import {
  createCarouselContainer,
  createImageContainer,
  createReelContainer,
  createStoryContainer,
  getContainerStatus,
  getPermalink,
  publishContainer,
} from "./graph/instagram.ts";
import { publishFbFeed, publishFbPhoto } from "./graph/facebook.ts";
import { getValidPageToken } from "./graph/oauth.ts";
import { checkAndIncrementBuc } from "./graph/rate-limit.ts";
import { loadTiktokAccount } from "./tiktok/_http.ts";
import { getValidTiktokAccessToken } from "./tiktok/oauth.ts";
import {
  DEFAULT_PRIVACY_LEVEL,
  fetchPublishStatus,
  initVideoPost,
  queryCreatorInfo,
} from "./tiktok/publish.ts";

const TERMINAL: ReadonlySet<string> = new Set(["PUBLISHED", "FAILED", "SKIPPED"]);

interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface TargetRow {
  id: number;
  accountId: number;
  network: string;
  placement: string;
  status: string;
  containerId: string | null;
  captionOverride: string | null;
  attempts: number;
}

interface PostRow {
  id: number;
  status: string;
  caption: string | null;
  hashtags: string[];
  mediaType: string;
  media: unknown;
  targets: TargetRow[];
}

export interface AdvanceResult {
  status: string;
  pending: number;
}

/** Arranca la publicación: pasa el post a PUBLISHING y avanza una vuelta. */
export async function publishSocialPost(postId: number): Promise<AdvanceResult> {
  const post = await db.socialPost.findUnique({ where: { id: postId } });
  if (!post) return { status: "missing", pending: 0 };
  if (post.status !== "SCHEDULED" && post.status !== "PUBLISHING") {
    return { status: post.status, pending: 0 };
  }
  await db.socialPost.update({ where: { id: postId }, data: { status: "PUBLISHING" } });
  return advanceSocialPost(postId);
}

/** Avanza cada target pendiente; cierra el post cuando todos quedan terminales. */
export async function advanceSocialPost(postId: number): Promise<AdvanceResult> {
  const post = (await db.socialPost.findUnique({
    where: { id: postId },
    include: { targets: true },
  })) as PostRow | null;
  if (!post) return { status: "missing", pending: 0 };
  if (post.status !== "PUBLISHING") return { status: post.status, pending: 0 };

  const dryRun = await getSocialDryRun();

  for (const target of post.targets) {
    if (TERMINAL.has(target.status)) continue;
    try {
      const patch = dryRun ? simulateTarget() : await stepTargetReal(post, target);
      await db.socialPostTarget.update({
        where: { id: target.id },
        data: { ...patch, attempts: target.attempts + 1, errorCode: null, errorMessage: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.socialPostTarget.update({
        where: { id: target.id },
        data: {
          status: "FAILED",
          errorMessage: message.slice(0, 500),
          attempts: target.attempts + 1,
        },
      });
    }
  }

  const targets = await db.socialPostTarget.findMany({ where: { postId } });
  const pending = targets.filter((t) => !TERMINAL.has(t.status)).length;

  if (pending === 0) {
    const anyFailed = targets.some((t) => t.status === "FAILED");
    const allFailed = targets.length > 0 && targets.every((t) => t.status === "FAILED");
    await db.socialPost.update({
      where: { id: postId },
      data: {
        status: allFailed ? "FAILED" : "PUBLISHED",
        publishedAt: new Date(),
        errorMessage:
          anyFailed && !allFailed
            ? "Algunos destinos fallaron"
            : allFailed
              ? "Publicación fallida"
              : null,
      },
    });
    logEvent("social.publish.done", {
      postId,
      status: allFailed ? "FAILED" : "PUBLISHED",
      failed: anyFailed,
    });
    return { status: allFailed ? "FAILED" : "PUBLISHED", pending: 0 };
  }

  return { status: "PUBLISHING", pending };
}

// ── Patches ──
type TargetStatus =
  | "PENDING"
  | "CREATING"
  | "CONTAINER_READY"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "SKIPPED";
type TargetPatch = {
  status: TargetStatus;
  containerId?: string | null;
  externalId?: string;
  permalink?: string | null;
  publishedAt?: Date;
};

function simulateTarget(): TargetPatch {
  return {
    status: "PUBLISHED",
    externalId: `dryrun_${Date.now()}`,
    permalink: null,
    publishedAt: new Date(),
  };
}

function buildCaption(post: PostRow, target: TargetRow): string | undefined {
  if (target.placement.endsWith("STORY")) return undefined; // las stories no llevan caption
  const base = target.captionOverride ?? post.caption ?? "";
  const tags = post.hashtags.length
    ? `\n\n${post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
    : "";
  const caption = `${base}${tags}`.trim();
  return caption.length > 0 ? caption : undefined;
}

/**
 * Avanza UN target contra el Graph real. IG: PENDING→crea container (CREATING);
 * CREATING→poll (FINISHED→publish→PUBLISHED, IN_PROGRESS→sigue pendiente,
 * ERROR/EXPIRED→throw). FB: publica síncrono.
 */
async function stepTargetReal(post: PostRow, target: TargetRow): Promise<TargetPatch> {
  const media = (post.media ?? []) as MediaItem[];
  const caption = buildCaption(post, target);

  // ── TikTok (Content Posting API, PULL_FROM_URL) ──
  if (target.network === "TIKTOK") {
    return stepTiktokTarget(post, target, media);
  }

  const loaded = await loadSocialAccount(target.accountId);
  if (!loaded) throw new Error(`SocialAccount ${target.accountId} no existe`);
  loaded.pageAccessToken = await getValidPageToken(loaded);

  // ── Facebook (síncrono) ──
  if (target.network === "FACEBOOK") {
    if (target.placement === "FB_FEED") {
      await checkAndIncrementBuc(loaded.id);
      const externalId = media[0]
        ? await publishFbPhoto(loaded, media[0].url, caption)
        : await publishFbFeed(loaded, caption ?? "");
      return { status: "PUBLISHED", externalId, publishedAt: new Date() };
    }
    throw new Error(`Placement ${target.placement} de Facebook aún no soportado (Fase B+)`);
  }

  // ── Instagram (container 3 pasos) ──
  if (!target.containerId) {
    await checkAndIncrementBuc(loaded.id);
    let containerId: string;
    if (target.placement === "IG_STORY") {
      const item = media[0];
      if (!item) throw new Error("Story sin media");
      containerId = await createStoryContainer(loaded, item.url, item.type === "video");
    } else if (target.placement === "IG_REEL") {
      const item = media[0];
      if (!item) throw new Error("Reel sin media");
      containerId = await createReelContainer(loaded, item.url, caption);
    } else if (post.mediaType === "CAROUSEL") {
      containerId = await createCarouselContainer(
        loaded,
        media.map((m) => ({ url: m.url, isVideo: m.type === "video" })),
        caption
      );
    } else {
      const item = media[0];
      if (!item) throw new Error("Post sin media");
      containerId = await createImageContainer(loaded, item.url, caption);
    }
    return { status: "CREATING", containerId };
  }

  // Ya hay container → pollear estado.
  await checkAndIncrementBuc(loaded.id);
  const status = await getContainerStatus(loaded, target.containerId);
  if (status === "IN_PROGRESS") {
    return { status: "CREATING", containerId: target.containerId }; // sigue pendiente
  }
  if (status === "ERROR" || status === "EXPIRED") {
    throw new Error(`Container ${status} en Instagram`);
  }
  // FINISHED → publicar
  await checkAndIncrementBuc(loaded.id);
  const mediaId = await publishContainer(loaded, target.containerId);
  const permalink = await getPermalink(loaded, mediaId);
  return { status: "PUBLISHED", externalId: mediaId, permalink, publishedAt: new Date() };
}

/**
 * Avanza UN target de TikTok (placement TIKTOK_VIDEO). PENDING → queryCreatorInfo
 * + init PULL_FROM_URL (guarda publish_id como containerId, CREATING). CREATING →
 * status/fetch → PUBLISH_COMPLETE → PUBLISHED; FAILED → throw; else sigue CREATING.
 * Pre-audit el privacy_level es SELF_ONLY (post privado del creador).
 */
async function stepTiktokTarget(
  post: PostRow,
  target: TargetRow,
  media: MediaItem[]
): Promise<TargetPatch> {
  const loaded = await loadTiktokAccount(target.accountId);
  if (!loaded) throw new Error(`SocialAccount ${target.accountId} no existe`);
  const token = await getValidTiktokAccessToken(loaded);

  // PENDING → init.
  if (!target.containerId) {
    const videoItem = media.find((m) => m.type === "video");
    if (!videoItem) {
      throw new Error("TikTok requiere un video (no hay media de tipo video en el post)");
    }
    const creator = await queryCreatorInfo(loaded, token);
    // Pre-audit solo SELF_ONLY está disponible; tras el audit el creator devuelve
    // los niveles públicos. Elegimos SELF_ONLY si está, sino el primero disponible.
    const privacyLevel = creator.privacyLevelOptions.includes(DEFAULT_PRIVACY_LEVEL)
      ? DEFAULT_PRIVACY_LEVEL
      : (creator.privacyLevelOptions[0] ?? DEFAULT_PRIVACY_LEVEL);
    const title = (target.captionOverride ?? post.caption ?? "").trim();
    const publishId = await initVideoPost(loaded, token, {
      videoUrl: videoItem.url,
      title,
      privacyLevel,
      disableComment: creator.commentDisabled,
      disableDuet: creator.duetDisabled,
      disableStitch: creator.stitchDisabled,
    });
    return { status: "CREATING", containerId: publishId };
  }

  // Ya hay publish_id → pollear estado.
  const result = await fetchPublishStatus(loaded, token, target.containerId);
  if (result.status === "PUBLISH_COMPLETE") {
    return {
      status: "PUBLISHED",
      externalId: result.postId ?? target.containerId,
      publishedAt: new Date(),
    };
  }
  if (result.status === "FAILED") {
    throw new Error(`TikTok publish FAILED: ${result.failReason ?? "sin detalle"}`);
  }
  // PROCESSING_* / SEND_TO_USER_INBOX → sigue pendiente.
  return { status: "CREATING", containerId: target.containerId };
}
