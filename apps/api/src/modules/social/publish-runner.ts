// State machine de publicación social (espejo liviano de wa-cloud/broadcast-runner).
//
// Fase A: el boundary real a Meta está en DRY-RUN (SOCIAL_PUBLISH_DRYRUN != "false"
// por defecto) — simula la publicación para ejercitar todo el flujo
// generar→aprobar→agendar→publicar sin App Review. En Fase B se reemplaza
// `publishTargetToMeta` por las llamadas reales al Graph API (instagram.ts/
// facebook.ts) y el tick de poll cobra sentido (container create→poll→publish).

import { db } from "@finanzas/db";

import { logEvent } from "../../lib/logger.ts";

const TERMINAL: ReadonlySet<string> = new Set(["PUBLISHED", "FAILED", "SKIPPED"]);

function isDryRun(): boolean {
  return process.env.SOCIAL_PUBLISH_DRYRUN !== "false";
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
  const post = await db.socialPost.findUnique({ where: { id: postId }, include: { targets: true } });
  if (!post) return { status: "missing", pending: 0 };
  if (post.status !== "PUBLISHING") return { status: post.status, pending: 0 };

  for (const target of post.targets) {
    if (TERMINAL.has(target.status)) continue;
    try {
      const result = await publishTargetToMeta(target.id);
      await db.socialPostTarget.update({
        where: { id: target.id },
        data: {
          status: "PUBLISHED",
          externalId: result.externalId,
          permalink: result.permalink,
          publishedAt: new Date(),
          attempts: target.attempts + 1,
          errorCode: null,
          errorMessage: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.socialPostTarget.update({
        where: { id: target.id },
        data: { status: "FAILED", errorMessage: message.slice(0, 500), attempts: target.attempts + 1 },
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
        errorMessage: anyFailed && !allFailed ? "Algunos destinos fallaron" : allFailed ? "Publicación fallida" : null,
      },
    });
    logEvent("social.publish.done", { postId, status: allFailed ? "FAILED" : "PUBLISHED", failed: anyFailed });
    return { status: allFailed ? "FAILED" : "PUBLISHED", pending: 0 };
  }

  return { status: "PUBLISHING", pending };
}

/**
 * Boundary único Fase A→B. Hoy: DRY-RUN (simula). Fase B: reemplazar por el
 * flujo real del Graph API (container create → poll FINISHED → media_publish).
 */
async function publishTargetToMeta(targetId: number): Promise<{ externalId: string; permalink: string | null }> {
  if (isDryRun()) {
    return { externalId: `dryrun_${targetId}`, permalink: null };
  }
  // Fase B: implementar en apps/api/src/modules/social/graph/{instagram,facebook}.ts
  throw new Error("Publicación real (Fase B) no implementada: conecta la Meta App y desactiva SOCIAL_PUBLISH_DRYRUN");
}
