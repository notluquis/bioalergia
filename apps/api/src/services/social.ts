// Service layer de publicación social (handlers finos → acá la lógica + DomainError).
// Aprobación-first: DRAFT → (approve) → SCHEDULED/PUBLISHING. Render vía Satori→R2.
// Fase A: el publish real está en dry-run (ver modules/social/publish-runner.ts).

import { db } from "@finanzas/db";
import type {
  connectMetaAccountInputSchema,
  createSocialPostInputSchema,
  renderSocialPostInputSchema,
  socialMediaItemSchema,
  updateSocialPostInputSchema,
} from "@finanzas/orpc-contracts/social";
import type { z } from "zod";

import { DomainError } from "../lib/errors.ts";
import { encryptSecret } from "../lib/secret-cipher.ts";
import { logEvent } from "../lib/logger.ts";
import { getSocialDryRun, setSocialDryRun } from "../lib/social-settings.ts";
import type { SocialAspectRatio } from "@finanzas/social-render";
import { renderAndUploadSocialImage } from "../modules/social/render.ts";

type MediaItem = z.infer<typeof socialMediaItemSchema>;
type CreateInput = z.infer<typeof createSocialPostInputSchema>;
type UpdateInput = z.infer<typeof updateSocialPostInputSchema>;
type RenderInput = z.infer<typeof renderSocialPostInputSchema>;
type ConnectInput = z.infer<typeof connectMetaAccountInputSchema>;

// Quita undefined de los items de media (columnas Json rechazan undefined).
function normalizeMedia(items: MediaItem[] | undefined): MediaItem[] {
  if (!items) return [];
  return items.map((it) => {
    const out: MediaItem = { key: it.key, url: it.url, type: it.type };
    if (it.width !== undefined) out.width = it.width;
    if (it.height !== undefined) out.height = it.height;
    if (it.durationMs !== undefined) out.durationMs = it.durationMs;
    return out;
  });
}

const POST_INCLUDE = { targets: { orderBy: { id: "asc" } } } as const;

function serializePost<T extends { media: unknown; hashtags: string[] }>(post: T) {
  return { ...post, hashtags: post.hashtags, media: (post.media ?? []) as MediaItem[] };
}

async function findPostOrThrow(id: number) {
  const post = await db.socialPost.findUnique({ where: { id }, include: POST_INCLUDE });
  if (!post) throw new DomainError("NOT_FOUND", "Publicación no encontrada");
  return post;
}

export async function listSocialPosts(filter: { status?: string }) {
  const posts = await db.socialPost.findMany({
    where: filter.status ? { status: filter.status as never } : undefined,
    include: POST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return posts.map((p) => serializePost(p));
}

export async function getSocialPost(id: number) {
  return serializePost(await findPostOrThrow(id));
}

export async function createSocialPost(input: CreateInput, createdByUserId: number) {
  const post = await db.socialPost.create({
    data: {
      title: input.title ?? null,
      status: "DRAFT",
      mediaType: input.mediaType,
      aspectRatio: input.aspectRatio,
      caption: input.caption ?? null,
      hashtags: input.hashtags ?? [],
      media: normalizeMedia(input.media) as never,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdByUserId,
      targets: {
        create: input.targets.map((t) => ({
          accountId: t.accountId,
          network: t.network,
          placement: t.placement,
          captionOverride: t.captionOverride ?? null,
        })),
      },
    },
    include: POST_INCLUDE,
  });
  logEvent("social.post.created", { postId: post.id, targets: post.targets.length });
  return serializePost(post);
}

export async function updateSocialPost(input: UpdateInput) {
  const post = await findPostOrThrow(input.id);
  if (post.status !== "DRAFT" && post.status !== "PENDING_APPROVAL") {
    throw new DomainError("CONFLICT", "Solo se puede editar un borrador o pendiente de aprobación");
  }
  const updated = await db.socialPost.update({
    where: { id: input.id },
    data: {
      title: input.title ?? undefined,
      caption: input.caption ?? undefined,
      hashtags: input.hashtags ?? undefined,
      media: input.media ? (normalizeMedia(input.media) as never) : undefined,
      scheduledAt: input.scheduledAt === undefined ? undefined : input.scheduledAt ? new Date(input.scheduledAt) : null,
    },
    include: POST_INCLUDE,
  });
  return serializePost(updated);
}

export async function renderSocialMedia(input: RenderInput) {
  const post = await findPostOrThrow(input.id);
  const rendered = await renderAndUploadSocialImage({
    postId: post.id,
    template: input.template,
    props: input.props ?? {},
    aspectRatio: post.aspectRatio as SocialAspectRatio,
  });
  const media = [...((post.media ?? []) as MediaItem[]), rendered];
  const updated = await db.socialPost.update({
    where: { id: post.id },
    data: { media: media as never },
    include: POST_INCLUDE,
  });
  return serializePost(updated);
}

export async function rejectSocialPost(id: number, reason: string) {
  const post = await findPostOrThrow(id);
  if (post.status === "PUBLISHED" || post.status === "PUBLISHING") {
    throw new DomainError("CONFLICT", "No se puede rechazar una publicación ya publicada o en curso");
  }
  const updated = await db.socialPost.update({
    where: { id },
    data: { status: "DRAFT", rejectedReason: reason, approvedAt: null, approvedByUserId: null },
    include: POST_INCLUDE,
  });
  return serializePost(updated);
}

export async function approveSocialPost(id: number, approvedByUserId: number) {
  const post = await findPostOrThrow(id);
  if (post.status !== "DRAFT" && post.status !== "PENDING_APPROVAL") {
    throw new DomainError("CONFLICT", "Solo se aprueba un borrador o pendiente de aprobación");
  }
  if (((post.media ?? []) as MediaItem[]).length === 0 && post.mediaType !== "IMAGE") {
    throw new DomainError("UNPROCESSABLE_ENTITY", "El post no tiene media renderizada");
  }
  // El disparo de la cola (enqueueJob de social_publish) lo hace el handler
  // oRPC (tier orpc → queue permitido; services NO importa queue). Acá solo la
  // transición de estado: SCHEDULED (a futuro) o PUBLISHING (ahora).
  const willSchedule = !!post.scheduledAt && post.scheduledAt.getTime() > Date.now();
  const updated = await db.socialPost.update({
    where: { id },
    data: {
      status: willSchedule ? "SCHEDULED" : "PUBLISHING",
      approvedByUserId,
      approvedAt: new Date(),
      rejectedReason: null,
    },
    include: POST_INCLUDE,
  });
  return serializePost(updated);
}

export async function scheduleSocialPost(id: number, scheduledAtIso: string) {
  const post = await findPostOrThrow(id);
  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 30_000) {
    throw new DomainError("BAD_REQUEST", "Agenda al menos 30 segundos en el futuro");
  }
  const updated = await db.socialPost.update({
    where: { id },
    data: { scheduledAt, status: post.approvedAt ? "SCHEDULED" : post.status },
    include: POST_INCLUDE,
  });
  return serializePost(updated);
}

export async function publishNowSocialPost(id: number) {
  const post = await findPostOrThrow(id);
  if (!post.approvedAt) throw new DomainError("CONFLICT", "Aprueba la publicación antes de publicar");
  const updated = await db.socialPost.update({ where: { id }, data: { status: "PUBLISHING" }, include: POST_INCLUDE });
  return serializePost(updated);
}

interface AccountRow {
  id: number;
  displayName: string | null;
  metaBusinessId: string | null;
  fbPageId: string | null;
  igUserId: string | null;
  tokenExpiresAt: Date | null;
  graphApiVersion: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function serializeAccount(account: AccountRow) {
  return {
    id: account.id,
    provider: "META" as const,
    displayName: account.displayName,
    metaBusinessId: account.metaBusinessId,
    fbPageId: account.fbPageId,
    igUserId: account.igUserId,
    tokenExpiresAt: account.tokenExpiresAt,
    graphApiVersion: account.graphApiVersion,
    active: account.active,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function getSocialSettings() {
  return { dryRun: await getSocialDryRun() };
}

export async function updateSocialSettings(input: { dryRun: boolean }) {
  await setSocialDryRun(input.dryRun);
  return { dryRun: input.dryRun };
}

export async function listSocialAccounts() {
  const accounts = await db.socialAccount.findMany({ orderBy: { id: "asc" } });
  return accounts.map((a) => serializeAccount(a));
}

export async function connectMetaAccount(input: ConnectInput) {
  // Fase A: persiste la cuenta con tokens encriptados (sin validar contra Meta).
  // Fase B: oauth.ts hará el exchange short→long-lived y derivará el page token.
  const account = await db.socialAccount.create({
    data: {
      provider: "META",
      displayName: input.displayName ?? null,
      appId: input.appId,
      appSecret: encryptSecret(input.appSecret),
      pageAccessToken: encryptSecret(input.shortLivedToken),
      igUserId: input.igUserId ?? null,
      fbPageId: input.fbPageId ?? null,
    },
  });
  logEvent("social.account.connected", { accountId: account.id });
  return serializeAccount(account);
}
