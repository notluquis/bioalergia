import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  adminArticleListResponseSchema,
  articleCreateInputSchema,
  articleDeleteResponseSchema,
  articleIdInputSchema,
  articleListResponseSchema,
  articleResponseSchema,
  articleUpdateInputSchema,
  slugInputSchema,
} from "@finanzas/orpc-contracts/site-content";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createArticle,
  deleteArticle,
  getArticleById,
  getPublishedArticleBySlug,
  listAllArticles,
  listPublishedArticles,
  updateArticle,
} from "../services/site-content.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type SiteContentORPCContext = { hono: HonoContext };

const base = os.$context<SiteContentORPCContext>();

const requireStaff = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  readingMinutes: number;
  body?: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
function serializeArticleSummary(row: Omit<ArticleRow, "body">) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt,
    reading_minutes: row.readingMinutes,
    status: row.status,
    seo_title: row.seoTitle,
    seo_description: row.seoDescription,
    published_at: row.publishedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
function serializeArticle(row: ArticleRow) {
  return {
    ...serializeArticleSummary(row),
    body: (row.body ?? []) as never,
  };
}

// ── public routes (apps/site) ─────────────────────────────────────────────────
const listArticlesRoute = base
  .route({ method: "GET", path: "/articles", summary: "List published articles", tags: ["SiteContent"] })
  .output(articleListResponseSchema)
  .handler(async () => {
    const rows = await listPublishedArticles();
    return { data: rows.map(serializeArticleSummary), status: "ok" as const };
  });

const getArticleBySlugRoute = base
  .route({ method: "GET", path: "/articles/by-slug/{slug}", summary: "Get published article by slug", tags: ["SiteContent"] })
  .input(slugInputSchema)
  .output(articleResponseSchema)
  .handler(async ({ input }) => {
    const row = await getPublishedArticleBySlug(input.slug);
    return { data: serializeArticle(row), status: "ok" as const };
  });

// ── admin routes (intranet) ───────────────────────────────────────────────────
const adminListArticlesRoute = requireStaff
  .route({ method: "GET", path: "/admin/articles", summary: "List all articles", tags: ["SiteContent"] })
  .output(adminArticleListResponseSchema)
  .handler(async () => {
    const rows = await listAllArticles();
    return { data: rows.map(serializeArticleSummary), status: "ok" as const };
  });

const adminGetArticleRoute = requireStaff
  .route({ method: "GET", path: "/admin/articles/{id}", summary: "Get article by id", tags: ["SiteContent"] })
  .input(articleIdInputSchema)
  .output(articleResponseSchema)
  .handler(async ({ input }) => {
    const row = await getArticleById(input.id);
    return { data: serializeArticle(row), status: "ok" as const };
  });

const adminCreateArticleRoute = requireStaff
  .route({ method: "POST", path: "/admin/articles", summary: "Create article", tags: ["SiteContent"] })
  .input(articleCreateInputSchema)
  .output(articleResponseSchema)
  .handler(async ({ input }) => {
    const row = await createArticle(input);
    return { data: serializeArticle(row), status: "ok" as const };
  });

const adminUpdateArticleRoute = requireStaff
  .route({ method: "PUT", path: "/admin/articles/{id}", summary: "Update article", tags: ["SiteContent"] })
  .input(articleUpdateInputSchema)
  .output(articleResponseSchema)
  .handler(async ({ input }) => {
    const row = await updateArticle(input);
    return { data: serializeArticle(row), status: "ok" as const };
  });

const adminDeleteArticleRoute = requireStaff
  .route({ method: "DELETE", path: "/admin/articles/{id}", summary: "Delete article", tags: ["SiteContent"] })
  .input(articleIdInputSchema)
  .output(articleDeleteResponseSchema)
  .handler(async ({ input }) => {
    await deleteArticle(input.id);
    return { status: "ok" as const };
  });

const siteContentORPCRouterBase = {
  listArticles: listArticlesRoute,
  getArticleBySlug: getArticleBySlugRoute,
  adminListArticles: adminListArticlesRoute,
  adminGetArticle: adminGetArticleRoute,
  adminCreateArticle: adminCreateArticleRoute,
  adminUpdateArticle: adminUpdateArticleRoute,
  adminDeleteArticle: adminDeleteArticleRoute,
};

export const siteContentORPCRouter = base
  .prefix("/api/orpc/site-content")
  .tag("SiteContent")
  .router(siteContentORPCRouterBase);

export const siteContentORPCHandler = new SuperJSONRPCHandler(siteContentORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("site-content.orpc.rpc", error, {});
    }),
  ],
});

export const siteContentOpenAPIHandler = new OpenAPIHandler(siteContentORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Site Content API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Site Content API",
          version: "1.0.0",
        },
      },
    }),
  ],
});
