import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  aiConfigResponseSchema,
  connectMetaAccountInputSchema,
  createSocialPostInputSchema,
  metaConfigResponseSchema,
  listSocialPostsInputSchema,
  rejectSocialPostInputSchema,
  renderAiHeroInputSchema,
  renderSocialPostInputSchema,
  scheduleSocialPostInputSchema,
  socialAccountResponseSchema,
  socialAccountsResponseSchema,
  socialIdInputSchema,
  socialPostResponseSchema,
  socialPostsResponseSchema,
  socialSettingsResponseSchema,
  socialSettingsSchema,
  tiktokConfigResponseSchema,
  updateAiConfigInputSchema,
  updateMetaConfigInputSchema,
  updateSocialPostInputSchema,
  updateTiktokConfigInputSchema,
} from "@finanzas/orpc-contracts/social";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { publishSocialPost } from "../modules/social/publish-runner.ts";
import { enqueueJob } from "../queue/runner.ts";
import { socialPublishJobKey } from "../queue/tasks/social-publish.ts";
import {
  approveSocialPost,
  connectMetaAccount,
  createSocialPost,
  getAiConfig,
  getMetaConfig,
  getSocialPost,
  getSocialSettings,
  getTiktokConfig,
  listSocialAccounts,
  listSocialPosts,
  publishNowSocialPost,
  rejectSocialPost,
  renderAiHero,
  renderSocialMedia,
  scheduleSocialPost,
  updateAiConfig,
  updateMetaConfig,
  updateSocialPost,
  updateSocialSettings,
  updateTiktokConfig,
} from "../services/social.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type SocialORPCContext = {
  hono: HonoContext;
};

type AuthedUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

const base = os.$context<SocialORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

function requirePost(action: "read" | "create" | "update" | "delete") {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "SocialPost");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

function requireAccount(action: "read" | "create") {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "SocialAccount");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readPost = requirePost("read");
const createPost = requirePost("create");
const updatePost = requirePost("update");

// Dispara la cola tras una transición del service. SCHEDULED → enqueue a runAt;
// PUBLISHING (publicar ahora) → enqueue inmediato con fallback inline si no hay
// runner (DISABLE_QUEUE_RUNNER). Devuelve el post ya actualizado.
async function triggerPublish(post: {
  id: number;
  status: string;
  scheduledAt?: Date | string | null;
}) {
  if (post.status === "SCHEDULED" && post.scheduledAt) {
    await enqueueJob(
      "social_publish",
      { postId: post.id },
      {
        runAt: new Date(post.scheduledAt),
        jobKey: socialPublishJobKey(post.id),
        jobKeyMode: "replace",
      }
    );
  } else if (post.status === "PUBLISHING") {
    const enqueued = await enqueueJob(
      "social_publish",
      { postId: post.id },
      { jobKey: socialPublishJobKey(post.id), jobKeyMode: "replace" }
    );
    if (!enqueued) await publishSocialPost(post.id);
  }
  return getSocialPost(post.id);
}

const socialORPCRouterBase = {
  list: readPost
    .route({ method: "GET", path: "/" })
    .input(listSocialPostsInputSchema)
    .output(socialPostsResponseSchema)
    .handler(async ({ input }) => ({ posts: await listSocialPosts(input) })),

  detail: readPost
    .route({ method: "GET", path: "/{id}" })
    .input(socialIdInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => ({ post: await getSocialPost(input.id), status: "ok" as const })),

  create: createPost
    .route({ method: "POST", path: "/" })
    .input(createSocialPostInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ context, input }) => ({
      post: await createSocialPost(input, (context.user as AuthedUser).id),
      status: "ok" as const,
    })),

  update: updatePost
    .route({ method: "PUT", path: "/{id}" })
    .input(updateSocialPostInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => ({ post: await updateSocialPost(input), status: "ok" as const })),

  render: updatePost
    .route({ method: "POST", path: "/{id}/render" })
    .input(renderSocialPostInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => ({
      post: await renderSocialMedia(input),
      status: "ok" as const,
    })),

  renderAiHero: updatePost
    .route({ method: "POST", path: "/{id}/render-ai-hero" })
    .input(renderAiHeroInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => ({
      post: await renderAiHero(input),
      status: "ok" as const,
    })),

  approve: updatePost
    .route({ method: "POST", path: "/{id}/approve" })
    .input(socialIdInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ context, input }) => {
      const post = await approveSocialPost(input.id, (context.user as AuthedUser).id);
      return { post: await triggerPublish(post), status: "ok" as const };
    }),

  reject: updatePost
    .route({ method: "POST", path: "/{id}/reject" })
    .input(rejectSocialPostInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => ({
      post: await rejectSocialPost(input.id, input.reason),
      status: "ok" as const,
    })),

  schedule: updatePost
    .route({ method: "POST", path: "/{id}/schedule" })
    .input(scheduleSocialPostInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => {
      const post = await scheduleSocialPost(input.id, input.scheduledAt);
      return { post: await triggerPublish(post), status: "ok" as const };
    }),

  publishNow: updatePost
    .route({ method: "POST", path: "/{id}/publish" })
    .input(socialIdInputSchema)
    .output(socialPostResponseSchema)
    .handler(async ({ input }) => {
      const post = await publishNowSocialPost(input.id);
      return { post: await triggerPublish(post), status: "ok" as const };
    }),

  listAccounts: requireAccount("read")
    .route({ method: "GET", path: "/accounts" })
    .input(z.object({}))
    .output(socialAccountsResponseSchema)
    .handler(async () => ({ accounts: await listSocialAccounts() })),

  connectAccount: requireAccount("create")
    .route({ method: "POST", path: "/accounts/connect" })
    .input(connectMetaAccountInputSchema)
    .output(socialAccountResponseSchema)
    .handler(async ({ input }) => ({
      account: await connectMetaAccount(input),
      status: "ok" as const,
    })),

  getMetaConfig: requireAccount("read")
    .route({ method: "GET", path: "/meta-config" })
    .input(z.object({}))
    .output(metaConfigResponseSchema)
    .handler(async () => ({ config: await getMetaConfig() })),

  updateMetaConfig: requireAccount("create")
    .route({ method: "PUT", path: "/meta-config" })
    .input(updateMetaConfigInputSchema)
    .output(metaConfigResponseSchema)
    .handler(async ({ input }) => ({ config: await updateMetaConfig(input) })),

  getTiktokConfig: requireAccount("read")
    .route({ method: "GET", path: "/tiktok-config" })
    .input(z.object({}))
    .output(tiktokConfigResponseSchema)
    .handler(async () => ({ config: await getTiktokConfig() })),

  updateTiktokConfig: requireAccount("create")
    .route({ method: "PUT", path: "/tiktok-config" })
    .input(updateTiktokConfigInputSchema)
    .output(tiktokConfigResponseSchema)
    .handler(async ({ input }) => ({ config: await updateTiktokConfig(input) })),

  getAiConfig: requireAccount("read")
    .route({ method: "GET", path: "/ai-config" })
    .input(z.object({}))
    .output(aiConfigResponseSchema)
    .handler(async () => ({ config: await getAiConfig() })),

  updateAiConfig: requireAccount("create")
    .route({ method: "PUT", path: "/ai-config" })
    .input(updateAiConfigInputSchema)
    .output(aiConfigResponseSchema)
    .handler(async ({ input }) => ({ config: await updateAiConfig(input) })),

  getSettings: requireAccount("read")
    .route({ method: "GET", path: "/settings" })
    .input(z.object({}))
    .output(socialSettingsResponseSchema)
    .handler(async () => ({ settings: await getSocialSettings() })),

  updateSettings: requireAccount("create")
    .route({ method: "PUT", path: "/settings" })
    .input(socialSettingsSchema)
    .output(socialSettingsResponseSchema)
    .handler(async ({ input }) => ({ settings: await updateSocialSettings(input) })),
};

export const socialORPCRouter = base
  .prefix("/api/orpc/social")
  .tag("Social")
  .router(socialORPCRouterBase);

export const socialORPCHandler = new SuperJSONRPCHandler(socialORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("social.orpc", error, {});
    }),
  ],
});

export const socialOpenAPIHandler = new OpenAPIHandler(socialORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Social API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: { title: "Bioalergia Social API", version: "1.0.0" },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("social.orpc.openapi", error, {});
    }),
  ],
});

export type SocialORPCRouter = typeof socialORPCRouter;
