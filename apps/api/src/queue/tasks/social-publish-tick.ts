// graphile-worker task: drena/pollea la publicación de un SocialPost
// (espejo de send_wa_broadcast_tick). Re-encola hasta que no queden targets
// pendientes o el post salga de PUBLISHING. Relevante en Fase B (poll del
// container de IG: IN_PROGRESS→FINISHED); en Fase A (dry-run) el publish cierra
// en una vuelta y este tick casi no corre.

import type { Task } from "graphile-worker";
import { z } from "zod";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { advanceSocialPost } from "../../modules/social/publish-runner.ts";
import { socialPublishJobKey } from "./social-publish.ts";

const POLL_GAP_MS = 10_000;

const socialPublishTickPayload = z.object({ postId: z.number().int().positive() });

export const social_publish_tick: Task = async (payload, helpers) => {
  const parsed = socialPublishTickPayload.safeParse(payload);
  if (!parsed.success) {
    logWarn("queue.social_publish_tick.invalid_payload", { error: parsed.error.message });
    return;
  }
  const { postId } = parsed.data;
  const res = await advanceSocialPost(postId);
  logEvent("queue.social_publish_tick", { postId, ...res });

  if (res.status !== "PUBLISHING" || res.pending === 0) return;

  await helpers.addJob(
    "social_publish_tick",
    { postId },
    {
      runAt: new Date(Date.now() + POLL_GAP_MS),
      jobKey: socialPublishJobKey(postId),
      jobKeyMode: "replace",
      queueName: socialPublishJobKey(postId),
    },
  );
};
