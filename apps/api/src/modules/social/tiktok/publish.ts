// TikTok Content Posting API — Direct Post de video vía PULL_FROM_URL.
//
// Flujo (espejo liviano del container de IG):
//   1. creator_info/query  → privacy_level_options + límites del creador
//   2. publish/video/init  → { publish_id }  (encola la descarga + publicación)
//   3. publish/status/fetch → poll hasta PUBLISH_COMPLETE / FAILED
//
// IMPORTANTE: hasta que la app pase el audit de video.publish, el único
// privacy_level permitido es SELF_ONLY (post privado del propio creador). El
// flujo funciona igual; al aprobar el audit, privacy_level_options incluirá los
// niveles públicos. El dominio del video_url DEBE estar verificado en el portal
// de TikTok (URL prefix / DNS) para que PULL_FROM_URL lo acepte.

import { tiktokPost, type LoadedTiktokAccount } from "./_http.ts";

/** privacy_level por defecto pre-audit: post privado del creador. */
export const DEFAULT_PRIVACY_LEVEL = "SELF_ONLY";

export interface TiktokCreatorInfo {
  privacyLevelOptions: string[];
  maxVideoPostDurationSec: number;
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  nickname?: string;
}

interface CreatorInfoResponse {
  privacy_level_options?: string[];
  max_video_post_duration_sec?: number;
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  creator_nickname?: string;
}

/** Consulta info del creador (privacy options + límites) — obligatorio antes de postear. */
export async function queryCreatorInfo(
  account: LoadedTiktokAccount,
  token: string
): Promise<TiktokCreatorInfo> {
  const data = await tiktokPost<CreatorInfoResponse>(
    "/v2/post/publish/creator_info/query/",
    {},
    token
  );
  return {
    privacyLevelOptions: data.privacy_level_options ?? [],
    maxVideoPostDurationSec: data.max_video_post_duration_sec ?? 0,
    commentDisabled: data.comment_disabled ?? false,
    duetDisabled: data.duet_disabled ?? false,
    stitchDisabled: data.stitch_disabled ?? false,
    nickname: data.creator_nickname,
  };
}

interface VideoInitResponse {
  publish_id?: string;
}

/**
 * Inicia un Direct Post de video por PULL_FROM_URL. privacy_level debe ser uno
 * de los devueltos por creator_info (pre-audit: SELF_ONLY). Devuelve publish_id.
 */
export async function initVideoPost(
  account: LoadedTiktokAccount,
  token: string,
  params: {
    videoUrl: string;
    title: string;
    privacyLevel: string;
    disableComment?: boolean;
    disableDuet?: boolean;
    disableStitch?: boolean;
  }
): Promise<string> {
  const data = await tiktokPost<VideoInitResponse>(
    "/v2/post/publish/video/init/",
    {
      post_info: {
        title: params.title.slice(0, 2200),
        privacy_level: params.privacyLevel,
        disable_comment: params.disableComment ?? false,
        disable_duet: params.disableDuet ?? false,
        disable_stitch: params.disableStitch ?? false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: params.videoUrl,
      },
    },
    token
  );
  if (!data.publish_id) throw new Error("TikTok video/init no devolvió publish_id");
  return data.publish_id;
}

export type TiktokPublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

interface StatusFetchResponse {
  status?: string;
  fail_reason?: string;
  publicaly_available_post_id?: string[];
  publicly_available_post_id?: string[];
}

export interface TiktokPublishStatusResult {
  status: TiktokPublishStatus;
  failReason?: string;
  postId?: string;
}

/** Pollea el estado de un publish_id. */
export async function fetchPublishStatus(
  account: LoadedTiktokAccount,
  token: string,
  publishId: string
): Promise<TiktokPublishStatusResult> {
  const data = await tiktokPost<StatusFetchResponse>(
    "/v2/post/publish/status/fetch/",
    { publish_id: publishId },
    token
  );
  const status = (data.status ?? "PROCESSING_UPLOAD") as TiktokPublishStatus;
  const postId =
    data.publicly_available_post_id?.[0] ?? data.publicaly_available_post_id?.[0] ?? undefined;
  return {
    status,
    failReason: data.fail_reason,
    postId,
  };
}
