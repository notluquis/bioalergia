// graphile-worker task: publica un SocialPost agendado a su hora.
//
// Enqueued por scheduleSocialPost/approveSocialPost (jobKey `social_publish_<id>`,
// replace, runAt = scheduledAt). Arranca la publicación y, si quedan targets
// pendientes (Fase B: container en proceso), encola el tick de poll.

import type { Task } from "graphile-worker";
import { z } from "zod";
import { logEvent, logWarn } from "../../lib/logger.ts";
import { publishSocialPost } from "../../modules/social/publish-runner.ts";

const POLL_GAP_MS = 10_000;

const socialPublishPayload = z.object({ postId: z.number().int().positive() });

export function socialPublishJobKey(postId: number): string {
  return `social_publish_${postId}`;
}

export const social_publish: Task = async (payload, helpers) => {
  const parsed = socialPublishPayload.safeParse(payload);
  if (!parsed.success) {
    logWarn("queue.social_publish.invalid_payload", { error: parsed.error.message });
    return;
  }
  const { postId } = parsed.data;
  const res = await publishSocialPost(postId);
  logEvent("queue.social_publish", { postId, ...res });

  if (res.status === "PUBLISHING" && res.pending > 0) {
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
  }
};
