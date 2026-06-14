import { oc } from "@orpc/contract";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// News/blog articles for /noticias on the public marketing site — DB-backed +
// intranet-editable (the only CMS surface). The rest of the site's content
// pages are static (hardcoded in apps/site/src/data/*.ts).
//
// Article scalar columns use snake_case like the catalog contract; `body` is a
// BodyBlock[] discriminated union.
// ──────────────────────────────────────────────────────────────────────────

export const contentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const bodyBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: z.string() }),
  z.object({ type: z.literal("h2"), text: z.string() }),
  z.object({ type: z.literal("ul"), items: z.array(z.string()) }),
]);
export type BodyBlock = z.infer<typeof bodyBlockSchema>;

export const articleSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  excerpt: z.string(),
  reading_minutes: z.number().int(),
  body: z.array(bodyBlockSchema),
  status: contentStatusSchema,
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  published_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

/** List view omits the heavy body. */
export const articleSummarySchema = articleSchema.omit({ body: true });

export const slugInputSchema = z.object({ slug: z.string() });
export const articleListResponseSchema = z.object({
  data: z.array(articleSummarySchema),
  status: z.literal("ok"),
});
export const articleResponseSchema = z.object({
  data: articleSchema,
  status: z.literal("ok"),
});
export const adminArticleListResponseSchema = z.object({
  data: z.array(articleSummarySchema),
  status: z.literal("ok"),
});

const slugField = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug kebab-case");

export const articleCreateInputSchema = z.object({
  slug: slugField,
  title: z.string().min(1),
  category: z.string().min(1),
  excerpt: z.string().min(1),
  reading_minutes: z.coerce.number().int().min(1).default(4),
  body: z.array(bodyBlockSchema),
  status: contentStatusSchema.default("DRAFT"),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  published_at: z.coerce.date().nullable().optional(),
});
export const articleUpdateInputSchema = articleCreateInputSchema
  .partial()
  .extend({ id: z.number().int() });
export const articleIdInputSchema = z.object({ id: z.number().int() });
export const articleDeleteResponseSchema = z.object({ status: z.literal("ok") });

// ── contract ──────────────────────────────────────────────────────────────────
export const siteContentContract = {
  // public (apps/site)
  listArticles: oc.route({ method: "GET", path: "/articles" }).output(articleListResponseSchema),
  getArticleBySlug: oc
    .route({ method: "GET", path: "/articles/by-slug/{slug}" })
    .input(slugInputSchema)
    .output(articleResponseSchema),

  // admin (intranet)
  adminListArticles: oc
    .route({ method: "GET", path: "/admin/articles" })
    .output(adminArticleListResponseSchema),
  adminGetArticle: oc
    .route({ method: "GET", path: "/admin/articles/{id}" })
    .input(articleIdInputSchema)
    .output(articleResponseSchema),
  adminCreateArticle: oc
    .route({ method: "POST", path: "/admin/articles" })
    .input(articleCreateInputSchema)
    .output(articleResponseSchema),
  adminUpdateArticle: oc
    .route({ method: "PUT", path: "/admin/articles/{id}" })
    .input(articleUpdateInputSchema)
    .output(articleResponseSchema),
  adminDeleteArticle: oc
    .route({ method: "DELETE", path: "/admin/articles/{id}" })
    .input(articleIdInputSchema)
    .output(articleDeleteResponseSchema),
};

export type SiteContentContract = typeof siteContentContract;
